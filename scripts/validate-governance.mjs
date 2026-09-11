import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

import {
  ATLAS_TAG_PATTERN,
  ATLAS_WORKSPACE_PACKAGES,
  CANONICAL_GOVERNANCE_DOC,
  LEGACY_PACKAGE_TAG_PATTERN,
  readJson,
  readRootVersion,
  readWorkspaceVersions,
} from "./atlas-workspaces.mjs";
import { extractChangelogSection } from "./extract-changelog-section.mjs";
import { isPreOnePointZero } from "./semver-utils.mjs";

const errors = [];

function fail(message) {
  errors.push(message);
}

function assertFileExists(relativePath, label) {
  if (!existsSync(path.join(process.cwd(), relativePath))) {
    fail(`Missing ${label}: ${relativePath}`);
  }
}

function assertLicenseIsApache(relativePath) {
  const pkg = readJson(relativePath);
  if (pkg.license !== "Apache-2.0") {
    fail(`${relativePath} license must be "Apache-2.0" (found: ${pkg.license ?? "none"})`);
  }
}

function assertPrivateWorkspace(relativePath) {
  const pkg = readJson(relativePath);
  if (pkg.private !== true) {
    fail(`${relativePath} must remain private (not an independent npm product)`);
  }
}

function checkLicenseFile() {
  const licensePath = path.join(process.cwd(), "LICENSE");
  if (!existsSync(licensePath)) {
    fail("Missing root LICENSE file");
    return;
  }

  const content = readFileSync(licensePath, "utf8");
  if (!content.includes("Apache License") || !content.includes("Version 2.0")) {
    fail("LICENSE does not appear to be Apache License 2.0");
  }
}

function checkVersionAlignment() {
  const rootVersion = readRootVersion();
  const workspaces = readWorkspaceVersions();

  for (const pkg of workspaces) {
    if (pkg.version !== rootVersion) {
      fail(
        `Version mismatch: root is ${rootVersion}, ${pkg.name} is ${pkg.version}`,
      );
    }
  }

  if (!isPreOnePointZero(rootVersion)) {
    fail(`Atlas version ${rootVersion} must remain < 1.0.0 until a deliberate 1.0 decision`);
  }
}

function checkChangelog() {
  const version = readRootVersion();
  const changelogPath = path.join(process.cwd(), "CHANGELOG.md");

  if (!existsSync(changelogPath)) {
    fail("Missing root CHANGELOG.md");
    return;
  }

  const changelog = readFileSync(changelogPath, "utf8");
  if (!extractChangelogSection(changelog, version)) {
    fail(`CHANGELOG.md has no section for current Atlas version ${version}`);
  }
}

function checkPackageScripts() {
  const pkg = readJson("package.json");
  if (pkg.scripts?.["docs:check"]?.includes("validate-governance")) {
    fail("docs:check must remain the documentation link checker");
  }
  if (!pkg.scripts?.["governance:check"]) {
    fail("Missing governance:check script");
  }
}

function checkReleaseWorkflow() {
  const workflowPath = path.join(process.cwd(), ".github/workflows/release.yml");
  if (!existsSync(workflowPath)) {
    fail("Missing .github/workflows/release.yml");
    return;
  }

  const workflow = readFileSync(workflowPath, "utf8");

  if (workflow.includes("@atlas/ui@")) {
    fail("release.yml still references package-style @atlas/ui@ tags");
  }

  if (workflow.includes("create-github-release")) {
    fail("release.yml must not invoke create-github-release while GitHub Release publication is disabled");
  }

  if (/publish:\s*/.test(workflow)) {
    fail("release.yml must not configure changesets/action publish while GitHub Release publication is disabled");
  }

  if (!workflow.includes("workflow_dispatch")) {
    fail("release.yml must support workflow_dispatch for release rehearsal");
  }

  if (workflow.includes("createRelease") || workflow.includes("createRef")) {
    fail("release.yml must not create Git tags or GitHub Releases while publication is disabled");
  }
}

function checkGovernanceDocLinks() {
  const readme = readFileSync(path.join(process.cwd(), "README.md"), "utf8");
  if (!readme.includes("releases-and-governance.md")) {
    fail("README.md must link to docs/how-we-build/releases-and-governance.md");
  }
}

function checkOssWording() {
  const files = [
    "README.md",
    "docs/public/faq.md",
    "docs/how-we-build/releases-and-governance.md",
  ];

  for (const file of files) {
    const content = readFileSync(path.join(process.cwd(), file), "utf8");
    if (/Atlas is open source(?!\s+under)/i.test(content)) {
      fail(`${file} must not claim unqualified open-source status; qualify with Apache-2.0`);
    }
  }
}

function checkTagFormat(tag) {
  if (!ATLAS_TAG_PATTERN.test(tag)) {
    fail(`Invalid Atlas tag format "${tag}" (expected vX.Y.Z)`);
  }

  if (LEGACY_PACKAGE_TAG_PATTERN.test(tag)) {
    fail(`Tag "${tag}" uses legacy package-style format; use vX.Y.Z`);
  }
}

function main() {
  console.log("Validating Atlas governance…");

  assertFileExists("LICENSE", "license file");
  assertFileExists(CANONICAL_GOVERNANCE_DOC, "governance documentation");
  assertFileExists("CHANGELOG.md", "changelog");
  assertFileExists("docs/migrations/README.md", "migrations index");
  assertFileExists("SECURITY.md", "security policy");
  assertFileExists("docs/security/threat-model.md", "threat model");
  assertFileExists("docs/how-we-build/security.md", "security engineering documentation");

  checkLicenseFile();
  assertLicenseIsApache("package.json");

  for (const pkg of ATLAS_WORKSPACE_PACKAGES) {
    assertLicenseIsApache(path.join(pkg.relativePath, "package.json"));
    assertPrivateWorkspace(path.join(pkg.relativePath, "package.json"));
  }

  checkVersionAlignment();
  checkChangelog();
  checkPackageScripts();
  checkReleaseWorkflow();
  checkGovernanceDocLinks();
  checkOssWording();

  const version = readRootVersion();
  checkTagFormat(`v${version}`);

  if (errors.length > 0) {
    console.error("Governance validation failed:\n");
    for (const error of errors) {
      console.error(`  ✗ ${error}`);
    }
    process.exit(1);
  }

  console.log(`✓ Atlas governance checks passed (version ${version})`);
}

main();
