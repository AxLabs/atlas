import { readFileSync } from "node:fs";
import path from "node:path";

import { LATEST_SCHEMA_VERSION } from "@atlas/project";

export function readAtlasPlatformVersion(repoRoot = process.cwd()): string {
  const packageJsonPath = path.join(repoRoot, "package.json");
  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: unknown };

  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new Error("Unable to read Atlas platform version from root package.json");
  }

  return parsed.version;
}

export function readVersionMetadata(repoRoot?: string) {
  return {
    atlasVersion: readAtlasPlatformVersion(repoRoot),
    contractSchemaVersion: LATEST_SCHEMA_VERSION,
    cliPackage: "@atlas/cli",
  };
}
