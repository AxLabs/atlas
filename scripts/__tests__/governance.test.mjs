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

  function assertPatchRelease(updated, version, previousVersion) {
    assert.match(updated, /## \[Unreleased\]/);
    assert.doesNotMatch(extractUnreleasedBody(updated), /Pending release work/);
    assert.match(updated, new RegExp(`## \\[${version.replace(/\./g, "\\.")}\\]`));
    assert.match(updated, /Pending release work/);
    assert.match(updated, /## \[0\.1\.0\]/);
    assert.match(updated, /Initial baseline/);
    assert.match(updated, new RegExp(`\\[Unreleased\\]: .*/v${version}\\.\\.\\.HEAD`));
    assert.match(
      updated,
      new RegExp(
        `\\[${version.replace(/\./g, "\\.")}\\]: .*/v${previousVersion}\\.\\.\\.v${version}`,
      ),
    );
    assert.match(updated, /\[0\.1\.0\]: https:\/\/github\.com\/blitzcraftlabs\/atlas\/releases\/tag\/v0\.1\.0/);
  }

  it("performs a patch release (0.1.0 → 0.1.1)", () => {
    const updated = updateRootChangelog(
      rootAt010,
      "0.1.1",
      "### Fixed\n- Workspace patch entry",
      "2026-08-20",
    );
    assertPatchRelease(updated, "0.1.1", "0.1.0");
    assert.match(updated, /Workspace patch entry/);
  });

  it("performs a minor release (0.1.x → 0.2.0)", () => {
    const updated = updateRootChangelog(
      rootAt010,
      "0.2.0",
      "### Changed\n- Breaking platform change",
      "2026-08-21",
    );
    assertPatchRelease(updated, "0.2.0", "0.1.0");
    assert.match(updated, /Breaking platform change/);
  });

  it("merges multiple package workspace bodies into one release section", () => {
    const updated = updateRootChangelog(
      rootAt010,
      "0.1.1",
      "### Added\n- UI change\n\n### Added\n- Web change",
      "2026-08-20",
    );
    assert.match(updated, /UI change/);
    assert.match(updated, /Web change/);
    const section = extractChangelogSection(updated, "0.1.1");
    assert.doesNotMatch(section, /## \[0\.1\.0\]/);
  });

  it("replaces an existing version section in place", () => {
    const withExisting = updateRootChangelog(
      rootAt010,
      "0.1.1",
      "### Added\n- First pass",
      "2026-08-20",
    );
    const refreshed = updateRootChangelog(
      withExisting,
      "0.1.1",
      "### Added\n- Revised release body",
      "2026-08-20",
    );
    assert.match(refreshed, /Revised release body/);
    assert.doesNotMatch(refreshed, /First pass/);
    assert.equal((refreshed.match(/## \[0\.1\.1\]/g) ?? []).length, 1);
  });

  it("is idempotent when run twice with equivalent workspace state", () => {
    const first = updateRootChangelog(
      rootAt010,
      "0.1.1",
      "### Fixed\n- Stable entry",
      "2026-08-20",
    );
    const authoritativeWorkspaceBody = extractSectionBody(
      extractChangelogSection(first, "0.1.1"),
    );
    const second = updateRootChangelog(
      first,
      "0.1.1",
      authoritativeWorkspaceBody,
      "2026-08-20",
    );
    assert.equal(second, first);
  });
});

describe("mergeChangelogSectionBodies", () => {
  it("deduplicates identical package sections", () => {
    const body = mergeChangelogSectionBodies([
      { name: "@atlas/ui", section: "## [0.1.1]\n\n### Added\n- Shared entry" },
      { name: "@atlas/web", section: "## [0.1.1]\n\n### Added\n- Shared entry" },
    ]);
    assert.equal(body, "### Added\n- Shared entry");
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
    assert.equal(body, "### Added\n- Shared entry");
  });
});

describe("findPreviousReleaseVersion", () => {
  it("selects the highest prior semver section", () => {
    const changelog = `## [Unreleased]

## [0.2.0] - 2026-08-20

## [0.1.0] - 2026-08-19
`;
    assert.equal(findPreviousReleaseVersion(changelog, "0.2.1"), "0.2.0");
    assert.equal(findPreviousReleaseVersion(changelog, "0.2.0"), "0.1.0");
  });
});

describe("updateChangelogLinkReferences", () => {
  it("advances [Unreleased] and inserts a new version link", () => {
    const updated = updateChangelogLinkReferences(
      `[Unreleased]: https://github.com/blitzcraftlabs/atlas/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/blitzcraftlabs/atlas/releases/tag/v0.1.0`,
      "0.1.1",
      "0.1.0",
    );
    assert.match(updated, /\[Unreleased\]: .+\/v0\.1\.1\.\.\.HEAD/);
    assert.match(updated, /\[0\.1\.1\]: .+\/v0\.1\.0\.\.\.v0\.1\.1/);
    assert.match(updated, /\[0\.1\.0\]:/);
  });
});

describe("semver utils", () => {
  it("treats 0.x.y as normal releases, not prereleases", () => {
    assert.equal(isPreOnePointZero("0.2.0"), true);
    assert.equal(hasSemverPrerelease("0.2.0"), false);
    assert.equal(isGithubPrerelease("0.2.0"), false);
  });

  it("detects SemVer prerelease components", () => {
    assert.equal(hasSemverPrerelease("0.2.0-rc.1"), true);
    assert.equal(isGithubPrerelease("0.2.0-beta.1"), true);
  });

  it("parses standard versions", () => {
    const parsed = parseSemver("0.2.0");
    assert.deepEqual(parsed, {
      major: 0,
      minor: 2,
      patch: 0,
      prerelease: null,
      build: null,
    });
  });
});

describe("release workflow policy", () => {
  it("does not configure live publication before #24", () => {
    const workflow = readFileSync(
      path.join(process.cwd(), ".github/workflows/release.yml"),
      "utf8",
    );
    assert.doesNotMatch(workflow, /publish:\s*/);
    assert.doesNotMatch(workflow, /create-github-release/);
    assert.doesNotMatch(workflow, /createRelease/);
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
      JSON.stringify({ name: "@atlas/ui", version: "0.1.1", private: true }),
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
      JSON.stringify({ name: "@atlas/monorepo", version: "0.1.0", private: true }),
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
      "utf8",
    );

    for (const pkg of ATLAS_WORKSPACE_PACKAGES) {
      mkdirSync(path.join(dir, pkg.relativePath), { recursive: true });
      writeFileSync(
        path.join(dir, pkg.relativePath, "package.json"),
        JSON.stringify({ name: pkg.name, version, private: true }),
      );
      writeFileSync(
        path.join(dir, pkg.relativePath, "CHANGELOG.md"),
        `## [${version}]\n\n### Added\n- ${pkg.name} release entry\n`,
        "utf8",
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
        `${pkg.name} changelog must contain version ${version}`,
      );
    }

    const root = readFileSync(path.join(dir, "CHANGELOG.md"), "utf8");
    assert.match(root, /## \[0\.1\.1\]/);
    assert.match(root, /Pending governance work/);
    assert.doesNotMatch(extractUnreleasedBody(root), /Pending governance work/);
  });
});
