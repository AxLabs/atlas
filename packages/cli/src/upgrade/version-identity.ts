import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export function readRootPackageVersion(repoRoot: string): string {
  const packageJsonPath = path.join(repoRoot, "package.json");
  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: unknown };

  if (typeof parsed.version !== "string" || parsed.version.trim().length === 0) {
    throw new Error(`Missing version in checkout root package.json (${packageJsonPath}).`);
  }

  return parsed.version;
}

export function writeRootPackageVersion(repoRoot: string, atlasVersion: string): void {
  const packageJsonPath = path.join(repoRoot, "package.json");
  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as Record<string, unknown>;
  parsed.version = atlasVersion;
  writeFileSync(packageJsonPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
}
