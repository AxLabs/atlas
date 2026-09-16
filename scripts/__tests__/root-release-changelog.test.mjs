import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { ATLAS_WORKSPACE_PACKAGES } from "../atlas-workspaces.mjs";
import { consolidateAtlasRelease, updateRootChangelog } from "../consolidate-atlas-release.mjs";
import { extractChangelogSection, extractSectionBody } from "../extract-changelog-section.mjs";
import {
  buildPlatformReleaseBody,
  isPackageBumpNoise,
  parseChangelogEntries,
} from "../root-release-changelog.mjs";

const ROOT_TEMPLATE = `# Changelog

All notable changes to **Atlas** (the repository/platform snapshot) are documented in this file.

## [Unreleased]

### Added

- Repository-level release governance: Apache-2.0 license, versioning policy, support expectations,
  breaking-change process, Version PR workflow, and fail-closed GitHub Release publication.
- Public documentation aligned to the Apache-2.0 GitHub repository: clone/fork access, contribution
  model, and durable evidence in place of private-era issue numbers.

## 0.1.0 - 2026-08-19

> Historical internal Atlas snapshot. No canonical public Git tag or GitHub Release was published
> for this version.

### Added

- Initial pre-1.0 platform snapshot baseline.
`;

const WEB_SECTION = `## 0.2.0

### Patch Changes

- 0589173: Align public documentation with the Apache-2.0 GitHub repository: clone/fork access,
  contribution model, and durable evidence instead of private-era issue numbers.
- 7835603: Establish Atlas repository-level release governance with Apache-2.0 licensing, unified
  platform versioning, migration policy, and Version PR automation.
- Updated dependencies [dbafd6b]
  - @atlas/ui@0.2.0
  - @atlas/consent@0.2.0
`;

const REFERENCE_SECTION = `## 0.2.0

### Patch Changes

- Updated dependencies [dbafd6b]
  - @atlas/ui@0.2.0
  - @atlas/consent@0.2.0
`;

const UI_SECTION = `## 0.2.0

### Patch Changes

- dbafd6b: Improve search input styling, badge alignment, and server-safe theme boot constants.

  - Suppress native WebKit search controls on \`Input\` when \`type="search"\` so apps can provide a
    single explicit clear button.
  - Center badge text with \`leading-none\` and give \`xs\` badges a stable fixed height.
  - Export server-safe theme constants and a shared boot script helper for root layouts.
`;

const CLI_SECTION = `## 0.2.0

### Minor Changes

- 95b0be9: Repair release automation so Version PRs validate at the new Atlas line and fail-closed
  GitHub Release publication can create the first canonical public \`vX.Y.Z\` tag after the Version PR
  merges.
- 96cc938: Make Atlas security checks blocking: HIGH/CRITICAL dependency policy, pinned Actions and
  Gitleaks, SPDX snapshots, and a published threat model.

### Patch Changes

- @atlas/project@0.2.0
`;

function platformBodyFromWorkspaceSections(sections, unreleasedBody = "") {
  return buildPlatformReleaseBody({
    unreleasedBody,
    workspaceBodies: sections.map((section) => ({ body: extractSectionBody(section) })),
  });
}

describe("root platform changelog consolidation", () => {
  it("does not emit repeated Changesets bump headings", () => {
    const body = platformBodyFromWorkspaceSections([WEB_SECTION, REFERENCE_SECTION, UI_SECTION, CLI_SECTION]);
    assert.doesNotMatch(body, /### Patch Changes/);
    assert.doesNotMatch(body, /### Minor Changes/);
    assert.equal((body.match(/^### /gm) ?? []).length, new Set(body.match(/^### .+$/gm) ?? []).size);
  });

  it("drops dependency-only updates", () => {
    const body = platformBodyFromWorkspaceSections([REFERENCE_SECTION]);
    assert.doesNotMatch(body, /Updated dependencies/);
    assert.doesNotMatch(body, /@atlas\/ui@0\.2\.0/);
    assert.doesNotMatch(body, /@atlas\/consent@0\.2\.0/);
    assert.equal(body, "");
  });

  it("drops bare workspace version bumps", () => {
    assert.equal(isPackageBumpNoise("@atlas/project@0.2.0"), true);
    const body = platformBodyFromWorkspaceSections([CLI_SECTION]);
    assert.doesNotMatch(body, /@atlas\/project@0\.2\.0/);
  });

  it("keeps meaningful workspace changes", () => {
    const body = platformBodyFromWorkspaceSections([UI_SECTION]);
    assert.match(body, /Improve search input styling, badge alignment, and server-safe theme boot constants\./);
    assert.doesNotMatch(body, /Suppress native WebKit/);
    assert.match(body, /### Changed/);
  });

  it("deduplicates unreleased platform prose against workspace changesets", () => {
    const unreleased = extractSectionBody(extractChangelogSection(ROOT_TEMPLATE, "Unreleased"));
    const body = platformBodyFromWorkspaceSections(
      [WEB_SECTION, REFERENCE_SECTION, UI_SECTION, CLI_SECTION],
      unreleased,
    );

    assert.equal((body.match(/release governance/gi) ?? []).length, 1);
    assert.equal((body.match(/public documentation/gi) ?? []).length, 1);
    assert.match(body, /Repository-level release governance/);
    assert.match(body, /Public documentation aligned/);
    assert.doesNotMatch(body, /Establish Atlas repository-level release governance/);
    assert.doesNotMatch(body, /Align public documentation with the Apache-2\.0 GitHub repository/);
    assert.match(body, /Repair release automation/);
    assert.match(body, /Make Atlas security checks blocking/);
    assert.match(body, /Improve search input styling/);
    assert.match(body, /### Added/);
    assert.match(body, /### Changed/);
    assert.match(body, /### Fixed/);
    assert.match(body, /### Security/);
  });

  it("maps security hardening to Security rather than Minor Changes", () => {
    const entries = parseChangelogEntries(extractSectionBody(CLI_SECTION), { source: "workspace" });
    const security = entries.find((entry) => /security checks/i.test(entry.text));
    assert.ok(security);
    const body = platformBodyFromWorkspaceSections([CLI_SECTION]);
    const securityIndex = body.indexOf("### Security");
    const textIndex = body.indexOf("Make Atlas security checks blocking");
    assert.ok(securityIndex >= 0 && textIndex > securityIndex);
    assert.ok(!body.slice(0, body.indexOf("### Security")).includes("Make Atlas security checks blocking"));
  });
});

describe("updateRootChangelog first public release links", () => {
  it("writes a coherent 0.2.0 section without linking historical 0.1.0", () => {
    const updated = updateRootChangelog(
      ROOT_TEMPLATE,
      "0.2.0",
      [
        { name: "@atlas/web", section: WEB_SECTION },
        { name: "@atlas/reference", section: REFERENCE_SECTION },
        { name: "@atlas/ui", section: UI_SECTION },
        { name: "@blitzcraftlabs/atlas", section: CLI_SECTION },
      ],
      "2026-09-12",
    );

    const section = extractChangelogSection(updated, "0.2.0");
    assert.match(section, /## \[0\.2\.0\] - 2026-09-12/);
    assert.doesNotMatch(section, /### Patch Changes/);
    assert.doesNotMatch(section, /### Minor Changes/);
    assert.doesNotMatch(updated, /v0\.1\.0/);
    assert.match(updated, /## 0\.1\.0 - 2026-08-19/);
    assert.match(
      updated,
      /\[Unreleased\]: https:\/\/github\.com\/blitzcraftlabs\/atlas\/compare\/v0\.2\.0\.\.\.HEAD/,
    );
    assert.match(
      updated,
      /\[0\.2\.0\]: https:\/\/github\.com\/blitzcraftlabs\/atlas\/releases\/tag\/v0\.2\.0/,
    );
  });
});

describe("consolidateAtlasRelease idempotence", () => {
  it("produces byte-for-byte identical root CHANGELOG.md on a second run", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "atlas-root-changelog-"));
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "@atlas/monorepo", version: "0.2.0" }));
    writeFileSync(path.join(dir, "CHANGELOG.md"), `${ROOT_TEMPLATE}\n`, "utf8");

    const changelogByPackage = {
      "@atlas/web": WEB_SECTION,
      "@atlas/reference": REFERENCE_SECTION,
      "@atlas/ui": UI_SECTION,
      "@blitzcraftlabs/atlas": CLI_SECTION,
    };

    for (const pkg of ATLAS_WORKSPACE_PACKAGES) {
      mkdirSync(path.join(dir, pkg.relativePath), { recursive: true });
      writeFileSync(
        path.join(dir, pkg.relativePath, "package.json"),
        JSON.stringify({ name: pkg.name, version: "0.2.0", private: true }),
      );
      writeFileSync(
        path.join(dir, pkg.relativePath, "CHANGELOG.md"),
        `# ${pkg.name}\n\n${changelogByPackage[pkg.name] ?? "## 0.2.0\n"}\n`,
        "utf8",
      );
    }

    consolidateAtlasRelease(dir);
    const first = readFileSync(path.join(dir, "CHANGELOG.md"), "utf8");
    consolidateAtlasRelease(dir);
    const second = readFileSync(path.join(dir, "CHANGELOG.md"), "utf8");

    assert.equal(second, first);
    assert.equal((first.match(/## \[0\.2\.0\]/g) ?? []).length, 1);
    assert.equal((first.match(/\[Unreleased\]:/g) ?? []).length, 1);
    assert.equal((first.match(/\[0\.2\.0\]:/g) ?? []).length, 1);
    assert.equal((first.match(/release governance/gi) ?? []).length, 1);
    assert.doesNotMatch(first, /### Patch Changes/);
    assert.doesNotMatch(first, /### Minor Changes/);
  });
});
