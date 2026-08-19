import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { readRootVersion } from "./atlas-workspaces.mjs";
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

function runScenario(baselineRoot, fixtureName, fixtureBody, expectations) {
  const scenarioRoot = path.join(path.dirname(baselineRoot), `scenario-${fixtureName}`);
  copyWorkspace(baselineRoot, scenarioRoot);

  const changesetPath = path.join(scenarioRoot, ".changeset", `rehearse-${fixtureName}.md`);
  writeFileSync(changesetPath, fixtureBody, "utf8");

  run("pnpm install --frozen-lockfile", scenarioRoot);
  run("pnpm changeset:version", scenarioRoot);

  const version = JSON.parse(
    readFileSync(path.join(scenarioRoot, "package.json"), "utf8"),
  ).version;

  if (expectations.expectedVersion && version !== expectations.expectedVersion) {
    throw new Error(
      `Scenario ${fixtureName}: expected version ${expectations.expectedVersion}, got ${version}`,
    );
  }

  if (version.startsWith("1.")) {
    throw new Error(`Scenario ${fixtureName}: version ${version} must remain pre-1.0`);
  }

  for (const pkg of ["apps/web", "packages/ui", "packages/config", "packages/consent"]) {
    if (existsSync(path.join(scenarioRoot, pkg, "CHANGELOG.md"))) {
      throw new Error(`Scenario ${fixtureName}: workspace changelog still exists at ${pkg}`);
    }
  }

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
        },
      },
      {
        name: "web-only",
        fixture: FIXTURE_CHANGES.webOnly,
        expectations: {
          expectedVersion: bumpPatch(startVersion),
          bodyIncludes: ["template examples page"],
        },
      },
      {
        name: "multi-package",
        fixture: FIXTURE_CHANGES.multiPackage,
        expectations: {
          expectedVersion: bumpPatch(startVersion),
          bodyIncludes: ["Align ESLint config"],
        },
      },
      {
        name: "breaking-pre-1",
        fixture: FIXTURE_CHANGES.breakingMinor,
        expectations: {
          expectedVersion: bumpMinor(startVersion),
          bodyIncludes: ["BREAKING", "theme boot"],
        },
      },
    ];

    for (const scenario of scenarios) {
      console.log(`  • scenario: ${scenario.name}`);
      runScenario(baselineRoot, scenario.name, scenario.fixture, scenario.expectations);
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
