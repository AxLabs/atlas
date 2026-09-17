import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { ATLAS_TAG_PATTERN, ATLAS_WORKSPACE_PACKAGES } from "../atlas-workspaces.mjs";
import {
  collectPackageChangelogSections,
  consolidateAtlasRelease,
  extractUnreleasedBody,
  findPreviousReleaseVersion,
  mergeChangelogSectionBodies,
  mergeReleaseBodies,
  updateChangelogLinkReferences,
  updateRootChangelog,
} from "../consolidate-atlas-release.mjs";
import {
  buildReleaseNotesPreview,
  extractChangelogSection,
  extractSectionBody,
} from "../extract-changelog-section.mjs";
import {
  hasSemverPrerelease,
  isGithubPrerelease,
  isPreOnePointZero,
  isStablePublicRelease,
  parseSemver,
} from "../semver-utils.mjs";

describe("extractChangelogSection", () => {
  const changelog = `# Changelog

## [Unreleased]

### Added
- Pending work

## [0.1.0] - 2026-08-19

### Added
- Initial release

## [0.0.1] - 2026-01-01

### Added
- Older
`;

  it("extracts a versioned section with bracket notation", () => {
    const section = extractChangelogSection(changelog, "0.1.0");
    assert.match(section, /## \[0\.1\.0\]/);
    assert.match(section, /Initial release/);
    assert.doesNotMatch(section, /Older/);
  });

  it("excludes Keep a Changelog link references after the section", () => {
    const withLinks = `${changelog}

[Unreleased]: https://example.com/compare/v0.1.0...HEAD
[0.1.0]: https://example.com/releases/tag/v0.1.0
`;
    const section = extractChangelogSection(withLinks, "0.1.0");
    assert.doesNotMatch(section, /compare\/v0\.1\.0/);
  });
});

describe("extractUnreleasedBody", () => {
  it("reads content under [Unreleased]", () => {
    const root = `## [Unreleased]

### Added
- Pending governance work

## [0.1.0] - 2026-08-19
`;
    assert.match(extractUnreleasedBody(root), /Pending governance work/);
  });
});

describe("updateRootChangelog lifecycle", () => {
  const rootAt010 = `# Changelog

## [Unreleased]

### Added
- Pending release work

## [0.1.0] - 2026-08-19

### Added
- Initial baseline

[Unreleased]: https://github.com/blitzcraftlabs/atlas/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/blitzcraftlabs/atlas/releases/tag/v0.1.0
`;

  function assertFirstPublicRelease(updated, version) {
    assert.match(updated, /## \[Unreleased\]/);
    assert.doesNotMatch(extractUnreleasedBody(updated), /Pending release work/);
    assert.match(updated, new RegExp(`## \\[${version.replace(/\./g, "\\.")}\\]`));
    assert.match(updated, /Pending release work/);
    assert.match(updated, /## \[0\.1\.0\]/);
    assert.match(updated, /Initial baseline/);
    assert.match(updated, new RegExp(`\\[Unreleased\\]: .*/v${version}\\.\\.\\.HEAD`));
    assert.match(
      updated,
      new RegExp(`\\[${version.replace(/\./g, "\\.")}\\]: .*/releases/tag/v${version}`)
    );
    assert.doesNotMatch(updated, /compare\/v0\.1\.0\.\.\./);
    assert.match(
      updated,
      /\[0\.1\.0\]: https:\/\/github\.com\/blitzcraftlabs\/atlas\/releases\/tag\/v0\.1\.0/
    );
  }

  it("performs a patch release (0.1.0 → 0.1.1)", () => {
    const updated = updateRootChangelog(
      rootAt010,
      "0.1.1",
      "### Fixed\n- Workspace patch entry",
      "2026-08-20"
    );
    assertFirstPublicRelease(updated, "0.1.1");
    assert.match(updated, /Workspace patch entry/);
  });

  it("performs a minor release (0.1.x → 0.2.0)", () => {
    const updated = updateRootChangelog(
      rootAt010,
      "0.2.0",
      "### Changed\n- Breaking platform change",
      "2026-08-21"
    );
    assertFirstPublicRelease(updated, "0.2.0");
    assert.match(updated, /Breaking platform change/);
  });

  it("merges multiple package workspace bodies into one release section", () => {
    const updated = updateRootChangelog(
      rootAt010,
      "0.1.1",
      "### Added\n- UI change\n\n### Added\n- Web change",
      "2026-08-20"
    );
    assert.match(updated, /UI change/);
    assert.match(updated, /Web change/);
    const section = extractChangelogSection(updated, "0.1.1");
    assert.doesNotMatch(section, /## \[0\.1\.0\]/);
    assert.equal((section.match(/### Added/g) ?? []).length, 1);
  });

  it("replaces an existing version section in place without duplicating the header", () => {
    const withExisting = updateRootChangelog(
      rootAt010,
      "0.1.1",
      "### Added\n- First pass",
      "2026-08-20"
    );
    const refreshed = updateRootChangelog(
      withExisting,
      "0.1.1",
      "### Added\n- Additional workspace note",
      "2026-08-20"
    );
    assert.match(refreshed, /First pass/);
    assert.match(refreshed, /Additional workspace note/);
    assert.match(refreshed, /Pending release work/);
    assert.equal((refreshed.match(/## \[0\.1\.1\]/g) ?? []).length, 1);
  });

  it("is idempotent when run twice with equivalent workspace state", () => {
    const workspaceBody = "### Fixed\n- Stable entry";
    const first = updateRootChangelog(rootAt010, "0.1.1", workspaceBody, "2026-08-20");
    const second = updateRootChangelog(first, "0.1.1", workspaceBody, "2026-08-20");
    assert.equal(second, first);
  });
});

describe("mergeChangelogSectionBodies", () => {
  it("deduplicates identical package sections", () => {
    const body = mergeChangelogSectionBodies([
      { name: "@atlas/ui", section: "## [0.1.1]\n\n### Added\n- Shared entry" },
      { name: "@atlas/web", section: "## [0.1.1]\n\n### Added\n- Shared entry" },
    ]);
    assert.equal(body, "### Added\n\n- Shared entry");
  });

  it("merges distinct package section bodies", () => {
    const body = mergeChangelogSectionBodies([
      { name: "@atlas/ui", section: "## [0.1.1]\n\n### Added\n- UI change" },
      { name: "@atlas/web", section: "## [0.1.1]\n\n### Added\n- Web change" },
    ]);
    assert.match(body, /UI change/);
    assert.match(body, /Web change/);
  });
});

describe("mergeReleaseBodies", () => {
  it("deduplicates identical unreleased and workspace content", () => {
    const body = mergeReleaseBodies("### Added\n- Shared entry", "### Added\n- Shared entry");
    assert.equal(body, "### Added\n\n- Shared entry");
  });
});

describe("findPreviousReleaseVersion", () => {
  it("selects the highest prior semver section", () => {
    const changelog = `## [Unreleased]

## [0.2.0] - 2026-08-20

## [0.1.0] - 2026-08-19
`;
    assert.equal(findPreviousReleaseVersion(changelog, "0.2.1"), "0.2.0");
    assert.equal(findPreviousReleaseVersion(changelog, "0.2.0"), null);
  });
});

describe("updateChangelogLinkReferences", () => {
  it("advances [Unreleased] and inserts a new version link", () => {
    const updated = updateChangelogLinkReferences(
      `[Unreleased]: https://github.com/blitzcraftlabs/atlas/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/blitzcraftlabs/atlas/releases/tag/v0.1.0`,
      "0.1.1",
      "0.1.0"
    );
    assert.match(updated, /\[Unreleased\]: .+\/v0\.1\.1\.\.\.HEAD/);
    assert.match(updated, /\[0\.1\.1\]: .+\/v0\.1\.0\.\.\.v0\.1\.1/);
    assert.match(updated, /\[0\.1\.0\]:/);
  });
});

describe("semver utils", () => {
  it("treats 0.x.y as normal releases, not prereleases", () => {
    assert.equal(isPreOnePointZero("0.2.0"), true);
    assert.equal(isPreOnePointZero("1.0.0"), false);
    assert.equal(hasSemverPrerelease("0.2.0"), false);
    assert.equal(isGithubPrerelease("0.2.0"), false);
    assert.equal(isGithubPrerelease("1.0.0"), false);
  });

  it("detects SemVer prerelease components", () => {
    assert.equal(hasSemverPrerelease("0.2.0-rc.1"), true);
    assert.equal(isGithubPrerelease("0.2.0-beta.1"), true);
  });

  it("parses standard versions", () => {
    const parsed = parseSemver("1.0.0");
    assert.deepEqual(parsed, {
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: null,
      build: null,
    });
    assert.equal(isStablePublicRelease("1.0.0"), true);
    assert.equal(isStablePublicRelease("0.5.0"), false);
  });
});

describe("Changesets public access policy", () => {
  it("keeps Changesets access public while other workspaces stay private", () => {
    const changesetConfig = JSON.parse(
      readFileSync(path.join(process.cwd(), ".changeset/config.json"), "utf8")
    );
    assert.equal(changesetConfig.access, "public");

    for (const pkg of ATLAS_WORKSPACE_PACKAGES) {
      const manifest = JSON.parse(
        readFileSync(path.join(process.cwd(), pkg.relativePath, "package.json"), "utf8")
      );
      if (pkg.name === "@blitzcraftlabs/atlas") {
        assert.notEqual(manifest.private, true);
        assert.equal(manifest.publishConfig?.access, "public");
        continue;
      }
      assert.equal(manifest.private, true, `${pkg.name} must remain private`);
      assert.notEqual(
        manifest.publishConfig?.access,
        "public",
        `${pkg.name} must not publish publicly`
      );
    }
  });

  it("documents that Changesets prefers package publishConfig.access", () => {
    const validator = readFileSync(
      path.join(process.cwd(), "scripts", "validate-governance.mjs"),
      "utf8"
    );
    assert.match(validator, /checkChangesetAccessPolicy/);
    assert.match(validator, /publishConfig\.access/);
  });
});

describe("release workflow policy", () => {
  it("publishes GitHub Releases through the fail-closed helper, not changesets npm publish", () => {
    const workflow = readFileSync(
      path.join(process.cwd(), ".github/workflows/release.yml"),
      "utf8"
    );
    assert.match(workflow, /publish-atlas-release/);
    assert.match(workflow, /workflow_dispatch/);
    assert.doesNotMatch(workflow, /changesets\/action[\s\S]{0,500}^\s+publish:\s+/m);
    assert.doesNotMatch(workflow, /continue-on-error/);
    assert.doesNotMatch(workflow, /@atlas\/ui@/);

    const versionPrJobStart = workflow.indexOf("  version-pr:");
    const versionPrNext = workflow
      .slice(versionPrJobStart + 1)
      .search(/\n {2}[A-Za-z0-9_-]+:\s*\n/);
    const versionPrJob =
      versionPrNext === -1
        ? workflow.slice(versionPrJobStart)
        : workflow.slice(versionPrJobStart, versionPrJobStart + 1 + versionPrNext);
    assert.match(versionPrJob, /id:\s*changesets/);
    assert.match(
      versionPrJob,
      /has-changesets:\s*\$\{\{\s*steps\.changesets\.outputs\.hasChangesets\s*\}\}/
    );

    const publishJobStart = workflow.indexOf("  github-release:");
    const nextJob = workflow.slice(publishJobStart + 1).search(/\n {2}[A-Za-z0-9_-]+:\s*\n/);
    const publishJob =
      nextJob === -1
        ? workflow.slice(publishJobStart)
        : workflow.slice(publishJobStart, publishJobStart + 1 + nextJob);
    assert.match(publishJob, /contents:\s*write/);
    assert.match(publishJob, /actions:\s*read/);
    assert.doesNotMatch(publishJob, /packages:\s*write/);
    assert.doesNotMatch(publishJob, /id-token:\s*write/);
    assert.match(publishJob, /needs:[\s\S]*\bsbom\b/);
    assert.match(publishJob, /needs:[\s\S]*\bversion-pr\b/);
    assert.match(publishJob, /github\.event_name\s*==\s*'push'/);
    assert.match(publishJob, /needs\.version-pr\.outputs\.has-changesets\s*!=\s*'true'/);

    const npmJobStart = workflow.indexOf("  npm-publish:");
    assert.notEqual(npmJobStart, -1);
    const npmNext = workflow.slice(npmJobStart + 1).search(/\n {2}[A-Za-z0-9_-]+:\s*\n/);
    const npmJob =
      npmNext === -1
        ? workflow.slice(npmJobStart)
        : workflow.slice(npmJobStart, npmJobStart + 1 + npmNext);
    assert.match(npmJob, /id-token:\s*write/);
    assert.match(npmJob, /contents:\s*read/);
    assert.doesNotMatch(npmJob, /contents:\s*write/);
    assert.doesNotMatch(npmJob, /NPM_TOKEN|NODE_AUTH_TOKEN/);
    assert.match(npmJob, /publish-npm-package\.mjs/);
    assert.match(npmJob, /--oidc/);
    assert.match(npmJob, /npm@11\.5\.1/);
    assert.match(npmJob, /needs:[\s\S]*\bgithub-release\b/);
    assert.match(npmJob, /needs:[\s\S]*\bversion-pr\b/);
    assert.match(npmJob, /distribution:verify-registry/);
    assert.match(npmJob, /fetch-tags:\s*true/);
    assert.match(npmJob, /steps\.npm\.outputs\.action != 'noop'/);
    assert.doesNotMatch(npmJob, /self-hosted/);
  });

  it("disables setup-node package-manager caching on the SBOM job that never installs", () => {
    const workflow = readFileSync(
      path.join(process.cwd(), ".github/workflows/release.yml"),
      "utf8"
    );

    const stripYamlComments = (content) =>
      content
        .split("\n")
        .map((line) => line.replace(/#.*$/, ""))
        .join("\n");

    const sbomJobStart = workflow.indexOf("  sbom:");
    const sbomNext = workflow.slice(sbomJobStart + 1).search(/\n {2}[A-Za-z0-9_-]+:\s*\n/);
    const sbomJob = stripYamlComments(
      sbomNext === -1
        ? workflow.slice(sbomJobStart)
        : workflow.slice(sbomJobStart, sbomJobStart + 1 + sbomNext)
    );
    assert.match(sbomJob, /node-version:\s*22\b/);
    assert.match(sbomJob, /package-manager-cache:\s*false/);
    assert.doesNotMatch(sbomJob, /\bpnpm install\b/);
    assert.doesNotMatch(sbomJob, /cache:\s*pnpm/);

    for (const jobId of ["rehearsal", "version-pr", "github-release", "npm-publish"]) {
      const start = workflow.indexOf(`  ${jobId}:`);
      const next = workflow.slice(start + 1).search(/\n {2}[A-Za-z0-9_-]+:\s*\n/);
      const job = stripYamlComments(
        next === -1 ? workflow.slice(start) : workflow.slice(start, start + 1 + next)
      );
      assert.match(job, /cache:\s*pnpm/);
    }
  });

  it("keeps publisher PENDING_CHANGESETS rejection as a backstop", () => {
    const publisher = readFileSync(
      path.join(process.cwd(), "scripts/release-publication.mjs"),
      "utf8"
    );
    assert.match(publisher, /PENDING_CHANGESETS/);
  });

  it("keeps ordered workflow-run fields and post-wait revalidation in the publisher", () => {
    const publisher = readFileSync(
      path.join(process.cwd(), "scripts/publish-atlas-release.mjs"),
      "utf8"
    );
    assert.match(publisher, /evaluateCurrentPublicationState/);
    assert.match(publisher, /REQUIRED_WORKFLOW_RUN_JSON_FIELDS/);
    assert.match(publisher, /databaseId/);
  });
});

describe("package scripts", () => {
  it("keeps docs:check as the link checker", () => {
    const pkg = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    assert.match(pkg.scripts["docs:check"], /check-doc-links/);
    assert.match(pkg.scripts["governance:check"], /validate-governance/);
  });
});

describe("ATLAS_TAG_PATTERN", () => {
  it("accepts canonical Atlas tags", () => {
    assert.equal(ATLAS_TAG_PATTERN.test("v0.1.0"), true);
  });

  it("rejects package-style tags", () => {
    assert.equal(ATLAS_TAG_PATTERN.test("@atlas/ui@0.1.0"), false);
  });
});

describe("buildReleaseNotesPreview", () => {
  it("includes changelog content and governance footer", () => {
    const changelog = `## [0.2.0] - 2026-08-20

### Changed
- Example change
`;
    const notes = buildReleaseNotesPreview(changelog, "0.2.0");
    assert.match(notes, /Example change/);
    assert.match(notes, /Releases and Governance/);
  });
});

describe("collectPackageChangelogSections fixture", () => {
  it("reads temporary workspace changelog sections", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "atlas-changelog-"));
    mkdirSync(path.join(dir, "packages/ui"), { recursive: true });
    const uiChangelog = path.join(dir, "packages/ui/CHANGELOG.md");
    writeFileSync(
      path.join(dir, "packages/ui/package.json"),
      JSON.stringify({ name: "@atlas/ui", version: "0.1.1", private: true })
    );
    writeFileSync(uiChangelog, "## [0.1.1]\n\n### Added\n- UI only\n", "utf8");

    const sections = collectPackageChangelogSections("0.1.1", dir);
    assert.equal(sections.length, 1);
    assert.match(extractSectionBody(sections[0].section), /UI only/);
  });
});

describe("preserves workspace changelogs required by changesets/action", () => {
  it("leaves workspace CHANGELOG.md files in place after consolidation", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "atlas-consolidate-"));
    const version = "0.1.1";

    writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "@atlas/monorepo", version: "0.1.0", private: true })
    );
    writeFileSync(
      path.join(dir, "CHANGELOG.md"),
      `# Changelog

## [Unreleased]

### Added
- Pending governance work

## [0.1.0] - 2026-08-19

### Added
- Initial baseline

[Unreleased]: https://github.com/blitzcraftlabs/atlas/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/blitzcraftlabs/atlas/releases/tag/v0.1.0
`,
      "utf8"
    );

    for (const pkg of ATLAS_WORKSPACE_PACKAGES) {
      mkdirSync(path.join(dir, pkg.relativePath), { recursive: true });
      writeFileSync(
        path.join(dir, pkg.relativePath, "package.json"),
        JSON.stringify({ name: pkg.name, version, private: true })
      );
      writeFileSync(
        path.join(dir, pkg.relativePath, "CHANGELOG.md"),
        `## [${version}]\n\n### Added\n- ${pkg.name} release entry\n`,
        "utf8"
      );
    }

    consolidateAtlasRelease(dir);

    for (const pkg of ATLAS_WORKSPACE_PACKAGES) {
      const changelogPath = path.join(dir, pkg.relativePath, "CHANGELOG.md");
      assert.equal(existsSync(changelogPath), true, `${pkg.name} changelog must exist`);
      const content = readFileSync(changelogPath, "utf8");
      assert.match(
        content,
        new RegExp(`## \\[${version.replace(/\./g, "\\.")}\\]`),
        `${pkg.name} changelog must contain version ${version}`
      );
    }

    const root = readFileSync(path.join(dir, "CHANGELOG.md"), "utf8");
    assert.match(root, /## \[0\.1\.1\]/);
    assert.match(root, /Pending governance work/);
    assert.doesNotMatch(extractUnreleasedBody(root), /Pending governance work/);
  });
});
