import { readFileSync } from "node:fs";
import path from "node:path";

import { LATEST_SCHEMA_VERSION } from "@atlas/project";

/** Directory containing @atlas/cli package metadata (packages/cli). */
const CLI_PACKAGE_ROOT = path.resolve(__dirname, "..");

function readPackageVersion(packageJsonPath: string, label: string): string {
  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: unknown };

  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new Error(`Missing version in ${label} (${packageJsonPath})`);
  }

  return parsed.version;
}

/** Atlas platform/CLI snapshot version from the installed @atlas/cli package. */
export function readCliAtlasVersion(): string {
  return readPackageVersion(path.join(CLI_PACKAGE_ROOT, "package.json"), "@atlas/cli");
}

/** Atlas source/checkout snapshot version from a target repository root. */
export function readCheckoutAtlasVersion(repoRoot: string): string {
  return readPackageVersion(path.join(repoRoot, "package.json"), "checkout root package.json");
}

export function readCliVersionMetadata() {
  return {
    atlasVersion: readCliAtlasVersion(),
    contractSchemaVersion: LATEST_SCHEMA_VERSION,
    cliPackage: "@atlas/cli",
  };
}
