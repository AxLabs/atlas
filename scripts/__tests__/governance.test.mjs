import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { ATLAS_TAG_PATTERN } from "../atlas-workspaces.mjs";
import {
  collectPackageChangelogSections,
  mergeChangelogSectionBodies,
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

describe("updateRootChangelog", () => {
  const root = `# Changelog

## [Unreleased]

### Added
- Pending governance work

## [0.1.0] - 2026-08-19

### Added
- Initial baseline

[Unreleased]: https://example.com/compare/v0.1.0...HEAD
[0.1.0]: https://example.com/releases/tag/v0.1.0
`;

  it("inserts a new release without removing prior sections", () => {
    const updated = updateRootChangelog(
      root,
      "0.2.0",
      "### Changed\n- UI export path update",
      "2026-08-20",
    );

    assert.match(updated, /## \[Unreleased\]/);
    assert.match(updated, /## \[0\.1\.0\]/);
    assert.match(updated, /Initial baseline/);
    assert.match(updated, /## \[0\.2\.0\]/);
    assert.match(updated, /UI export path update/);
    assert.match(updated, /\[0\.1\.0\]:/);
  });

  it("replaces an existing version section in place", () => {
    const updated = updateRootChangelog(root, "0.1.0", "### Added\n- Revised baseline", "2026-08-19");
    assert.match(updated, /Revised baseline/);
    assert.doesNotMatch(updated, /Initial baseline/);
    assert.doesNotMatch(updated, /## \[0\.2\.0\]/);
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
