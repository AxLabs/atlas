import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import { ATLAS_WORKSPACE_PACKAGES, readJson } from "./atlas-workspaces.mjs";
import {
  extractChangelogSection,
  extractSectionBody,
  extractSectionDate,
} from "./extract-changelog-section.mjs";
import { assertPreOnePointZero } from "./semver-utils.mjs";

function writeJson(relativePath, data, repoRoot) {
  const filePath = path.join(repoRoot, relativePath);
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function syncWorkspaceVersions(version, repoRoot = process.cwd()) {
  writeJson("package.json", { ...readJson("package.json", repoRoot), version }, repoRoot);

  for (const pkg of ATLAS_WORKSPACE_PACKAGES) {
    const pkgPath = path.join(pkg.relativePath, "package.json");
    writeJson(pkgPath, { ...readJson(pkgPath, repoRoot), version }, repoRoot);
  }
}

export function collectPackageChangelogSections(version, repoRoot = process.cwd()) {
  const sections = [];

  for (const pkg of ATLAS_WORKSPACE_PACKAGES) {
    const changelogPath = path.join(repoRoot, pkg.relativePath, "CHANGELOG.md");
    if (!existsSync(changelogPath)) {
      continue;
    }

    const content = readFileSync(changelogPath, "utf8");
    const section = extractChangelogSection(content, version);
    if (section) {
      sections.push({ name: pkg.name, section });
    }
  }

  return sections;
}

export function mergeChangelogSectionBodies(sections) {
  const bodies = sections.map((entry) => extractSectionBody(entry.section).trim()).filter(Boolean);

  const uniqueBodies = [...new Set(bodies)];
  return uniqueBodies.join("\n\n").trim();
}

export function updateRootChangelog(rootContent, version, mergedBody, dateLine) {
  const header = dateLine ? `## [${version}] - ${dateLine}` : `## [${version}]`;
  const newSection = `${header}\n${mergedBody.trim()}\n`;
  const escaped = version.replace(/\./g, "\\.");
  const headerPattern = new RegExp(
    `^##\\s+(?:\\[${escaped}\\]|${escaped})(?:\\s+-\\s+.+)?\\s*$`,
    "m",
  );
  const headerMatch = rootContent.match(headerPattern);

  if (headerMatch) {
    const start = headerMatch.index;
    const afterHeader = rootContent.slice(start + headerMatch[0].length);
    const nextSection = afterHeader.search(/\n##\s+/);
    const nextLinkRef = afterHeader.search(/\n\[[^\]]+\]:\s/);
    const endOffset = Math.min(
      nextSection === -1 ? afterHeader.length : nextSection,
      nextLinkRef === -1 ? afterHeader.length : nextLinkRef,
    );
    const end = start + headerMatch[0].length + endOffset;
    return `${rootContent.slice(0, start)}${newSection.trim()}\n${rootContent.slice(end).trimStart()}`;
  }

  const unreleasedMatch = rootContent.match(/^##\s+\[Unreleased\]\s*$/m);
  if (!unreleasedMatch) {
    throw new Error("Root CHANGELOG.md must contain an [Unreleased] section");
  }

  const afterUnreleasedStart = unreleasedMatch.index + unreleasedMatch[0].length;
  const afterUnreleased = rootContent.slice(afterUnreleasedStart);
  const nextHeader = afterUnreleased.search(/^##\s+/m);
  const insertAt =
    nextHeader === -1 ? rootContent.length : afterUnreleasedStart + nextHeader;

  return `${rootContent.slice(0, insertAt).trimEnd()}\n\n${newSection}${rootContent.slice(insertAt)}`;
}

export function removeWorkspaceChangelogs(repoRoot = process.cwd()) {
  for (const pkg of ATLAS_WORKSPACE_PACKAGES) {
    const changelogPath = path.join(repoRoot, pkg.relativePath, "CHANGELOG.md");
    if (existsSync(changelogPath)) {
      unlinkSync(changelogPath);
    }
  }
}

export function consolidateAtlasRelease(repoRoot = process.cwd()) {
  const version = readJson(
    path.join(ATLAS_WORKSPACE_PACKAGES[0].relativePath, "package.json"),
    repoRoot,
  ).version;

  assertPreOnePointZero(version);

  const packageSections = collectPackageChangelogSections(version, repoRoot);
  const mergedBody = mergeChangelogSectionBodies(packageSections);

  if (!mergedBody && packageSections.length === 0) {
    throw new Error(
      `No workspace changelog sections found for Atlas version ${version}. Was changeset version run?`,
    );
  }

  const dateLine =
    packageSections.map((entry) => extractSectionDate(entry.section)).find(Boolean) ??
  new Date().toISOString().slice(0, 10);

  const rootChangelogPath = path.join(repoRoot, "CHANGELOG.md");
  const rootContent = readFileSync(rootChangelogPath, "utf8");
  const updatedRoot = updateRootChangelog(rootContent, version, mergedBody, dateLine);
  writeFileSync(rootChangelogPath, updatedRoot.endsWith("\n") ? updatedRoot : `${updatedRoot}\n`, "utf8");

  syncWorkspaceVersions(version, repoRoot);
  removeWorkspaceChangelogs(repoRoot);

  return { version, mergedBody, dateLine };
}

import { pathToFileURL } from "node:url";

function main() {
  const result = consolidateAtlasRelease();
  console.log(
    `Consolidated Atlas ${result.version} into CHANGELOG.md and synced workspace versions`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
