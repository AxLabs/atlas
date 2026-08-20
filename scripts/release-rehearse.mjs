import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { ATLAS_WORKSPACE_PACKAGES, readRootVersion } from "./atlas-workspaces.mjs";
import { buildReleaseNotesPreview, extractChangelogSection } from "./extract-changelog-section.mjs";
import { isGithubPrerelease } from "./semver-utils.mjs";

const FIXTURE_CHANGES = {
  uiOnly: `---
"@atlas/ui": patch
---

Improve Input search styling for template consumers.`,
  webOnly: `---
"@atlas/web": patch
---

Update template examples page copy.`,
  multiPackage: `---
"@atlas/ui": patch
"@atlas/config": patch
---

Align ESLint config with new UI export.`,
  breakingMinor: `---
"@atlas/ui": minor
---

**BREAKING**: Rename theme boot export path. Migration: import from @atlas/ui/theme-boot.`,
  withPendingUpstream: `---
"@atlas/web": patch
---

Add release governance documentation and validation scripts for issue #19.`,
};

const RSYNC_EXCLUDES = [
  "node_modules",
  ".turbo",
  ".next",
  ".cursor",
  "coverage",
  "playwright-report",
  "test-results",
  ".git",
];

function run(command, cwd) {
  execSync(command, { cwd, stdio: "pipe", env: { ...process.env, CI: "true" } });
}

function copyWorkspace(source, target) {
  const excludes = RSYNC_EXCLUDES.map((entry) => `--exclude ${entry}`).join(" ");
  run(`rsync -a --delete ${excludes} "${source}/" "${target}/"`, os.tmpdir());
}

function readVersion(scenarioRoot) {
  return JSON.parse(readFileSync(path.join(scenarioRoot, "package.json"), "utf8")).version;
}

function assertWorkspaceChangelogs(scenarioRoot, version, fixtureName) {
  for (const pkg of ATLAS_WORKSPACE_PACKAGES) {
    const changelogPath = path.join(scenarioRoot, pkg.relativePath, "CHANGELOG.md");
    if (!existsSync(changelogPath)) {
      throw new Error(
        `Scenario ${fixtureName}: missing workspace changelog at ${pkg.relativePath}/CHANGELOG.md`,
      );
    }

    const content = readFileSync(changelogPath, "utf8");
    if (!extractChangelogSection(content, version)) {
      throw new Error(
        `Scenario ${fixtureName}: ${pkg.relativePath}/CHANGELOG.md missing section for ${version}`,
      );
    }
  }
}

function assertAlignedVersions(scenarioRoot, version, fixtureName) {
  const rootVersion = readVersion(scenarioRoot);
  if (rootVersion !== version) {
    throw new Error(
      `Scenario ${fixtureName}: root version ${rootVersion} does not match expected ${version}`,
    );
  }

  for (const pkg of ATLAS_WORKSPACE_PACKAGES) {
    const pkgVersion = JSON.parse(
      readFileSync(path.join(scenarioRoot, pkg.relativePath, "package.json"), "utf8"),
    ).version;
    if (pkgVersion !== version) {
      throw new Error(
        `Scenario ${fixtureName}: ${pkg.relativePath} version ${pkgVersion} != ${version}`,
      );
    }
  }
}

function runScenario(baselineRoot, fixtureName, fixtureBody, expectations, options = {}) {
  const scenarioRoot = path.join(path.dirname(baselineRoot), `scenario-${fixtureName}`);
  copyWorkspace(baselineRoot, scenarioRoot);

  if (options.extraChangeset) {
    writeFileSync(
      path.join(scenarioRoot, ".changeset", `rehearse-upstream-${fixtureName}.md`),
      options.extraChangeset,
      "utf8",
    );
  }

  const changesetPath = path.join(scenarioRoot, ".changeset", `rehearse-${fixtureName}.md`);
  writeFileSync(changesetPath, fixtureBody, "utf8");

  run("pnpm install --frozen-lockfile", scenarioRoot);
  run("pnpm changeset:version", scenarioRoot);

  const version = readVersion(scenarioRoot);

  if (expectations.expectedVersion && version !== expectations.expectedVersion) {
    throw new Error(
      `Scenario ${fixtureName}: expected version ${expectations.expectedVersion}, got ${version}`,
    );
  }

  if (version.startsWith("1.")) {
    throw new Error(`Scenario ${fixtureName}: version ${version} must remain pre-1.0`);
  }

  assertWorkspaceChangelogs(scenarioRoot, version, fixtureName);
  assertAlignedVersions(scenarioRoot, version, fixtureName);

  const rootChangelog = readFileSync(path.join(scenarioRoot, "CHANGELOG.md"), "utf8");
  if (!extractChangelogSection(rootChangelog, "Unreleased")) {
    throw new Error(`Scenario ${fixtureName}: root [Unreleased] section missing`);
  }

  const versionSection = extractChangelogSection(rootChangelog, version);
  if (!versionSection) {
    throw new Error(`Scenario ${fixtureName}: root changelog missing version ${version}`);
  }

  if (expectations.bodyIncludes) {
    for (const snippet of expectations.bodyIncludes) {
      if (!versionSection.includes(snippet)) {
        throw new Error(`Scenario ${fixtureName}: changelog missing "${snippet}"`);
      }
    }
  }

  if (expectations.unreleasedCleared) {
    const unreleased = extractChangelogSection(rootChangelog, "Unreleased");
    if (unreleased && /###\s+/.test(unreleased)) {
      throw new Error(`Scenario ${fixtureName}: [Unreleased] still contains release headings`);
    }
  }

  const notes = buildReleaseNotesPreview(rootChangelog, version);
  if (!notes.includes(`Atlas ${version}`)) {
    throw new Error(`Scenario ${fixtureName}: release notes preview missing Atlas version label`);
  }

  if (isGithubPrerelease(version)) {
    throw new Error(`Scenario ${fixtureName}: ${version} should not be treated as prerelease`);
  }

  rmSync(scenarioRoot, { recursive: true, force: true });
}

function main() {
  const repoRoot = process.cwd();
  const startVersion = readRootVersion(repoRoot);
  const snapshotParent = mkdtempSync(path.join(os.tmpdir(), "atlas-release-rehearse-"));
  const baselineRoot = path.join(snapshotParent, "baseline");

  console.log("Atlas release rehearsal (isolated copy — no GitHub API calls)");

  try {
    copyWorkspace(repoRoot, baselineRoot);

    const scenarios = [
      {
        name: "ui-only",
        fixture: FIXTURE_CHANGES.uiOnly,
        expectations: {
          expectedVersion: bumpPatch(startVersion),
          bodyIncludes: ["Improve Input search styling"],
          unreleasedCleared: true,
        },
      },
      {
        name: "web-only",
        fixture: FIXTURE_CHANGES.webOnly,
        expectations: {
          expectedVersion: bumpPatch(startVersion),
          bodyIncludes: ["template examples page"],
          unreleasedCleared: true,
        },
      },
      {
        name: "multi-package",
        fixture: FIXTURE_CHANGES.multiPackage,
        expectations: {
          expectedVersion: bumpPatch(startVersion),
          bodyIncludes: ["Align ESLint config"],
          unreleasedCleared: true,
        },
      },
      {
        name: "breaking-pre-1",
        fixture: FIXTURE_CHANGES.breakingMinor,
        expectations: {
          expectedVersion: bumpMinor(startVersion),
          bodyIncludes: ["BREAKING", "theme boot"],
          unreleasedCleared: true,
        },
      },
      {
        name: "with-pending-upstream",
        fixture: FIXTURE_CHANGES.withPendingUpstream,
        extraChangeset: FIXTURE_CHANGES.uiOnly,
        expectations: {
          expectedVersion: bumpPatch(startVersion),
          bodyIncludes: ["release governance", "Improve Input search styling"],
          unreleasedCleared: true,
        },
      },
    ];

    for (const scenario of scenarios) {
      console.log(`  • scenario: ${scenario.name}`);
      runScenario(
        baselineRoot,
        scenario.name,
        scenario.fixture,
        scenario.expectations,
        { extraChangeset: scenario.extraChangeset },
      );
    }

    const realStatus = execSync("git status --porcelain", { cwd: repoRoot, encoding: "utf8" }).trim();
    if (realStatus) {
      console.log("ℹ️ Real working tree has uncommitted changes (expected during development).");
    }

    console.log(`  Tag preview (current line): v${startVersion}`);
    console.log(`  GitHub prerelease flag for ${startVersion}: ${isGithubPrerelease(startVersion)}`);
    console.log("✓ Release rehearsal completed — real repo unchanged");
  } finally {
    rmSync(snapshotParent, { recursive: true, force: true });
  }
}

function bumpPatch(version) {
  const [major, minor, patch] = version.split(".").map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

function bumpMinor(version) {
  const [major, minor] = version.split(".").map(Number);
  return `${major}.${minor + 1}.0`;
}

main();
