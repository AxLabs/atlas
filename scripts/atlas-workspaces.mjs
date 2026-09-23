import { readFileSync } from "node:fs";
import path from "node:path";

/** Public npm identity of the Atlas CLI. Other workspaces remain private/source-owned. */
export const PUBLIC_CLI_PACKAGE_NAME = "@blitzcraftlabs/atlas";
export const PUBLIC_CLI_BIN_NAME = "atlas";
export const PUBLIC_CLI_RELATIVE_PATH = "packages/cli";

/**
 * Graph-aware CLI build used for pack, publish, and doctor.
 * Turbo `build.dependsOn: ["^build"]` compiles `@atlas/project` (`exports` → `dist/`)
 * before `packages/cli` `tsc`. `pnpm --filter <cli> build` does not.
 */
export const PUBLIC_CLI_WORKSPACE_BUILD_ARGS = [
  "turbo",
  "build",
  "--filter",
  PUBLIC_CLI_PACKAGE_NAME,
];

/** Workspace packages that share the Atlas release version (not independent products). */
export const ATLAS_WORKSPACE_PACKAGES = [
  { name: "@atlas/web", relativePath: "apps/web" },
  { name: "@atlas/reference", relativePath: "apps/reference" },
  { name: "@atlas/ui", relativePath: "packages/ui" },
  { name: "@atlas/config", relativePath: "packages/config" },
  { name: "@atlas/consent", relativePath: "packages/consent" },
  { name: "@atlas/project", relativePath: "packages/project" },
  { name: PUBLIC_CLI_PACKAGE_NAME, relativePath: PUBLIC_CLI_RELATIVE_PATH },
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
