import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { ATLAS_WORKSPACE_PACKAGES, readJson } from "./atlas-workspaces.mjs";
import { HISTORICAL_UNPUBLISHED_VERSIONS } from "./release-publication.mjs";
import {
  extractChangelogSection,
  extractSectionBody,
  extractSectionDate,
} from "./extract-changelog-section.mjs";
import { assertPreOnePointZero, parseSemver } from "./semver-utils.mjs";

const ATLAS_REPO_COMPARE = "https://github.com/blitzcraftlabs/atlas/compare";
const ATLAS_REPO_RELEASES = "https://github.com/blitzcraftlabs/atlas/releases/tag";

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

/** Merge root [Unreleased] content with workspace-generated release bodies, deduplicating identical text. */
export function mergeReleaseBodies(...bodies) {
  const parts = bodies.map((body) => body.trim()).filter(Boolean);
  const unique = [...new Set(parts)];
  return unique.join("\n\n").trim();
}

export function extractUnreleasedBody(rootContent) {
  const unreleasedMatch = rootContent.match(/^##\s+\[Unreleased\]\s*$/m);
  if (!unreleasedMatch) {
    return "";
  }

  const afterStart = unreleasedMatch.index + unreleasedMatch[0].length;
  const afterUnreleased = rootContent.slice(afterStart);
  const nextHeader = afterUnreleased.search(/^##\s+/m);
  let body = nextHeader === -1 ? afterUnreleased : afterUnreleased.slice(0, nextHeader);

  const linkRefIndex = body.search(/^\[[^\]]+\]:\s/m);
  if (linkRefIndex !== -1) {
    body = body.slice(0, linkRefIndex);
  }

  return body.trim();
}

export function resetUnreleasedSection(rootContent) {
  const unreleasedMatch = rootContent.match(/^##\s+\[Unreleased\]\s*$/m);
  if (!unreleasedMatch) {
    throw new Error("Root CHANGELOG.md must contain an [Unreleased] section");
  }

  const afterStart = unreleasedMatch.index + unreleasedMatch[0].length;
  const afterUnreleased = rootContent.slice(afterStart);
  const nextHeader = afterUnreleased.search(/^##\s+/m);
  const nextSectionStart = nextHeader === -1 ? rootContent.length : afterStart + nextHeader;
  const remainder = rootContent.slice(nextSectionStart).replace(/^\s+/, "");

  return `${rootContent.slice(0, afterStart)}\n\n${remainder}`;
}

export function findReleaseVersions(rootContent) {
  const pattern = /^##\s+\[(\d+\.\d+\.\d+)\]/gm;
  const versions = [];
  let match = pattern.exec(rootContent);
  while (match) {
    versions.push(match[1]);
    match = pattern.exec(rootContent);
  }
  return versions;
}

function compareParsedSemver(a, b) {
  if (a.major !== b.major) {
    return a.major - b.major;
  }
  if (a.minor !== b.minor) {
    return a.minor - b.minor;
  }
  if (a.patch !== b.patch) {
    return a.patch - b.patch;
  }

  if (!a.prerelease && b.prerelease) {
    return 1;
  }
  if (a.prerelease && !b.prerelease) {
    return -1;
  }
  if (!a.prerelease && !b.prerelease) {
    return 0;
  }

  return a.prerelease.localeCompare(b.prerelease);
}

export function findPreviousReleaseVersion(rootContent, newVersion) {
  const newParsed = parseSemver(newVersion);
  if (!newParsed) {
    return null;
  }

  let previous = null;
  let previousParsed = null;

  for (const version of findReleaseVersions(rootContent)) {
    if (version === newVersion) {
      continue;
    }

    if (HISTORICAL_UNPUBLISHED_VERSIONS.includes(version)) {
      continue;
    }

    const parsed = parseSemver(version);
    if (!parsed || compareParsedSemver(parsed, newParsed) >= 0) {
      continue;
    }

    if (!previousParsed || compareParsedSemver(parsed, previousParsed) > 0) {
      previous = version;
      previousParsed = parsed;
    }
  }

  return previous;
}

export function updateChangelogLinkReferences(rootContent, version, previousVersion) {
  const unreleasedLink = `[Unreleased]: ${ATLAS_REPO_COMPARE}/v${version}...HEAD`;
  const versionLink = previousVersion
    ? `[${version}]: ${ATLAS_REPO_COMPARE}/v${previousVersion}...v${version}`
    : `[${version}]: ${ATLAS_REPO_RELEASES}/v${version}`;

  let content = rootContent;

  if (/\[Unreleased\]:\s/.test(content)) {
    content = content.replace(/\[Unreleased\]:\s*.+/, unreleasedLink);
  } else {
    content = `${content.trimEnd()}\n\n${unreleasedLink}\n`;
  }

  const escaped = version.replace(/\./g, "\\.");
  const versionLinkPattern = new RegExp(`\\[${escaped}\\]:\\s*.+`);

  if (versionLinkPattern.test(content)) {
    content = content.replace(versionLinkPattern, versionLink);
  } else if (previousVersion) {
    const previousEscaped = previousVersion.replace(/\./g, "\\.");
    const previousLinkPattern = new RegExp(`^(\\[${previousEscaped}\\]:\\s*.+)$`, "m");
    if (previousLinkPattern.test(content)) {
      content = content.replace(previousLinkPattern, `${versionLink}\n$1`);
    } else {
      content = `${content.trimEnd()}\n${versionLink}\n`;
    }
  } else {
    content = `${content.trimEnd()}\n${versionLink}\n`;
  }

  return content;
}

function insertOrUpdateVersionSection(rootContent, version, releaseBody, dateLine) {
  const header = dateLine ? `## [${version}] - ${dateLine}` : `## [${version}]`;
  const newSection = `${header}\n${releaseBody.trim()}\n`;
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
    const before = rootContent.slice(0, start).trimEnd();
    const after = rootContent.slice(end).trimStart();
    return `${before}\n\n${newSection.trim()}\n\n${after}`;
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

  const before = rootContent.slice(0, insertAt).trimEnd();
  const after = rootContent.slice(insertAt).trimStart();
  return `${before}\n\n${newSection.trim()}\n\n${after}`;
}

export function updateRootChangelog(rootContent, version, workspaceBody, dateLine) {
  const unreleasedBody = extractUnreleasedBody(rootContent);
  const releaseBody = mergeReleaseBodies(unreleasedBody, workspaceBody);

  let content = resetUnreleasedSection(rootContent);
  content = insertOrUpdateVersionSection(content, version, releaseBody, dateLine);

  const previousVersion = findPreviousReleaseVersion(content, version);
  content = updateChangelogLinkReferences(content, version, previousVersion);

  return content;
}

export function consolidateAtlasRelease(repoRoot = process.cwd()) {
  const version = readJson(
    path.join(ATLAS_WORKSPACE_PACKAGES[0].relativePath, "package.json"),
    repoRoot,
  ).version;

  assertPreOnePointZero(version);

  const packageSections = collectPackageChangelogSections(version, repoRoot);
  const workspaceBody = mergeChangelogSectionBodies(packageSections);

  if (!workspaceBody && packageSections.length === 0) {
    throw new Error(
      `No workspace changelog sections found for Atlas version ${version}. Was changeset version run?`,
    );
  }

  const dateLine =
    packageSections.map((entry) => extractSectionDate(entry.section)).find(Boolean) ??
    new Date().toISOString().slice(0, 10);

  const rootChangelogPath = path.join(repoRoot, "CHANGELOG.md");
  const rootContent = readFileSync(rootChangelogPath, "utf8");
  const updatedRoot = updateRootChangelog(rootContent, version, workspaceBody, dateLine);
  writeFileSync(rootChangelogPath, updatedRoot.endsWith("\n") ? updatedRoot : `${updatedRoot}\n`, "utf8");

  syncWorkspaceVersions(version, repoRoot);

  return { version, mergedBody: workspaceBody, dateLine };
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
