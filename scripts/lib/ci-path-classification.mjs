/**
 * Shared CI path helpers for change detection.
 *
 * Release/version metadata must not by itself start UI Quality or Bundle Analysis.
 * Distribution clean-room gating uses a separate classifier and still treats those
 * paths as publication-critical.
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../..");

export const RELEASE_METADATA_PATH_PATTERN =
  /(^|\/)CHANGELOG\.md$|^\.changeset\/|^packages\/cli\/release-assets\/production\//;

export const PACKAGE_MANIFEST_PATH_PATTERN = /(^|\/)package\.json$/;

export function normalizeRepoPath(filePath) {
  return String(filePath).replaceAll("\\", "/").replace(/^\.\//, "");
}

export function isReleaseMetadataPath(filePath) {
  return RELEASE_METADATA_PATH_PATTERN.test(normalizeRepoPath(filePath));
}

export function isPackageManifestPath(filePath) {
  return PACKAGE_MANIFEST_PATH_PATTERN.test(normalizeRepoPath(filePath));
}

/**
 * Changesets/version/changelog/generated production snapshots, including the
 * package.json version bumps that `changeset version` writes.
 *
 * A package.json-only dependency edit is not release-only: it still needs UI or
 * bundle analysis when those classifiers match.
 */
export function isReleaseOnlyChange(files) {
  const normalized = files.map(normalizeRepoPath).filter(Boolean);
  if (normalized.length === 0) {
    return false;
  }

  const hasReleaseRecord = normalized.some((file) => isReleaseMetadataPath(file));
  if (!hasReleaseRecord) {
    return false;
  }

  return normalized.every((file) => isReleaseMetadataPath(file) || isPackageManifestPath(file));
}

export function listGitChangedFiles(base, head, { cwd = REPO_ROOT } = {}) {
  const stdout = execFileSync("git", ["diff", "--name-only", base, head], {
    encoding: "utf8",
    cwd,
  });
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
