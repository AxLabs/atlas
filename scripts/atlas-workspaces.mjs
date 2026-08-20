import { readFileSync } from "node:fs";
import path from "node:path";

/** Workspace packages that share the Atlas release version (not independent products). */
export const ATLAS_WORKSPACE_PACKAGES = [
  { name: "@atlas/web", relativePath: "apps/web" },
  { name: "@atlas/ui", relativePath: "packages/ui" },
  { name: "@atlas/config", relativePath: "packages/config" },
  { name: "@atlas/consent", relativePath: "packages/consent" },
  { name: "@atlas/project", relativePath: "packages/project" },
  { name: "@atlas/cli", relativePath: "packages/cli" },
];

export const CANONICAL_GOVERNANCE_DOC = "docs/how-we-build/releases-and-governance.md";

/** SemVer release tags: v0.1.0, v1.2.3 */
export const ATLAS_TAG_PATTERN = /^v\d+\.\d+\.\d+$/;

/** Misleading package-style release tags from the old workflow. */
export const LEGACY_PACKAGE_TAG_PATTERN = /^@atlas\//;

export function readJson(relativePath, repoRoot = process.cwd()) {
  const filePath = path.join(repoRoot, relativePath);
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function readRootVersion(repoRoot = process.cwd()) {
  return readJson("package.json", repoRoot).version;
}

export function readWorkspaceVersions(repoRoot = process.cwd()) {
  return ATLAS_WORKSPACE_PACKAGES.map((pkg) => ({
    ...pkg,
    version: readJson(path.join(pkg.relativePath, "package.json"), repoRoot).version,
  }));
}
