import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { ATLAS_CONTRACT_FILENAME, LATEST_SCHEMA_VERSION } from "@atlas/project";

/** npm package name of the Atlas CLI. Distinct from a target checkout's Atlas version. */
export const CLI_PACKAGE_NAME = "@blitzcraftlabs/atlas";

interface PackageJsonFields {
  name?: unknown;
  version?: unknown;
}

function readPackageJson(packageJsonPath: string): PackageJsonFields {
  return JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJsonFields;
}

function readPackageVersion(packageJsonPath: string, label: string): string {
  const parsed = readPackageJson(packageJsonPath);

  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new Error(`Missing version in ${label} (${packageJsonPath})`);
  }

  return parsed.version;
}

/**
 * Locate the installed `@blitzcraftlabs/atlas` package root from a file inside that package.
 * Walks toward filesystem root and requires `package.json` name `@blitzcraftlabs/atlas` so a
 * caller's project `package.json` cannot satisfy version resolution.
 */
export function findCliPackageRoot(startDir: string): string {
  let current = path.resolve(startDir);

  while (true) {
    const packageJsonPath = path.join(current, "package.json");
    if (existsSync(packageJsonPath)) {
      const parsed = readPackageJson(packageJsonPath);
      if (parsed.name === CLI_PACKAGE_NAME) {
        return current;
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error(`Unable to locate ${CLI_PACKAGE_NAME} package.json from ${startDir}`);
}

/** Atlas platform/CLI snapshot version from the installed @blitzcraftlabs/atlas package. */
export function readCliAtlasVersion(): string {
  return readPackageVersion(
    path.join(findCliPackageRoot(__dirname), "package.json"),
    CLI_PACKAGE_NAME
  );
}

/**
 * Atlas version for a target repository root.
 *
 * Generated consumer projects keep an independent app `package.json` version and record the Atlas
 * snapshot in `atlas.config.json` `platform.baseline.atlasVersion`. Platform/source checkouts that
 * still vendor `@blitzcraftlabs/atlas` continue to use root `package.json.version` so a historical baseline
 * does not replace the checkout's current Atlas identity.
 */
export function readCheckoutAtlasVersion(repoRoot: string): string {
  if (!isAtlasPlatformCheckout(repoRoot)) {
    const baselineVersion = readBaselineAtlasVersion(repoRoot);
    if (baselineVersion) {
      return baselineVersion;
    }
  }

  return readPackageVersion(path.join(repoRoot, "package.json"), "checkout root package.json");
}

function isAtlasPlatformCheckout(repoRoot: string): boolean {
  const cliPackageJsonPath = path.join(repoRoot, "packages", "cli", "package.json");
  if (!existsSync(cliPackageJsonPath)) {
    return false;
  }

  try {
    return readPackageJson(cliPackageJsonPath).name === CLI_PACKAGE_NAME;
  } catch {
    return false;
  }
}

function readBaselineAtlasVersion(repoRoot: string): string | undefined {
  const contractPath = path.join(repoRoot, ATLAS_CONTRACT_FILENAME);
  if (!existsSync(contractPath)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(readFileSync(contractPath, "utf8")) as {
      platform?: { baseline?: { atlasVersion?: unknown } };
    };
    const atlasVersion = parsed.platform?.baseline?.atlasVersion;
    if (typeof atlasVersion === "string" && atlasVersion.length > 0) {
      return atlasVersion;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function readCliVersionMetadata() {
  return {
    atlasVersion: readCliAtlasVersion(),
    contractSchemaVersion: LATEST_SCHEMA_VERSION,
    cliPackage: CLI_PACKAGE_NAME,
  };
}
