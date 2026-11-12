import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

import { PUBLIC_CLI_PACKAGE_NAME } from "../atlas-workspaces.mjs";
import { parseSemver } from "../semver-utils.mjs";
import { assertOutsideRepo, isInsideDirectory } from "./distribution-clean-room.mjs";
import { NPM_REGISTRY_URL, assertSafeNpmIdentity } from "./npm-publication.mjs";

const TARBALL_PATTERN = /\.tgz($|[?#])/i;

/**
 * @param {string | undefined} value
 * @returns {string}
 */
export function parseRegistryVersionArgument(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Registry verification requires an exact version argument, for example 0.5.0");
  }
  const version = value.trim();
  if (TARBALL_PATTERN.test(version) || version.startsWith("file:")) {
    throw new Error("Registry verification does not accept a local tarball");
  }
  if (version.includes("..") || version.includes("/") || version.includes("\\")) {
    throw new Error(`Refusing path-like version argument ${JSON.stringify(version)}`);
  }
  if (parseSemver(version) === null) {
    throw new Error(`Refusing unsafe registry version ${JSON.stringify(version)}`);
  }
  assertSafeNpmIdentity({ packageName: PUBLIC_CLI_PACKAGE_NAME, version });
  return version;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function collectRegistryFallbackIssues(env = process.env) {
  const issues = [];
  const offlineKeys = [
    "npm_config_offline",
    "NPM_CONFIG_OFFLINE",
    "npm_config_prefer_offline",
    "NPM_CONFIG_PREFER_OFFLINE",
    "PNPM_OFFLINE",
  ];
  for (const key of offlineKeys) {
    if (env[key] === "true" || env[key] === "1") {
      issues.push(`${key} would allow an offline/local fallback`);
    }
  }
  return issues;
}

/**
 * @param {string} specifier
 */
export function assertRegistryInstallSpecifier(specifier) {
  if (
    TARBALL_PATTERN.test(specifier) ||
    specifier.startsWith("file:") ||
    specifier.startsWith("/")
  ) {
    throw new Error("Registry verification must not install a local tarball");
  }
  const expectedPrefix = `${PUBLIC_CLI_PACKAGE_NAME}@`;
  if (!specifier.startsWith(expectedPrefix)) {
    throw new Error(`Registry install specifier must start with ${expectedPrefix}`);
  }
  parseRegistryVersionArgument(specifier.slice(expectedPrefix.length));
}

/**
 * @param {string} version
 */
export function registryInstallSpecifier(version) {
  const exact = parseRegistryVersionArgument(version);
  return `${PUBLIC_CLI_PACKAGE_NAME}@${exact}`;
}

const REGISTRY_LAG_SIGNATURES = Object.freeze([
  "ERR_PNPM_NO_MATCHING_VERSION",
  "ERR_PNPM_FETCH_404",
  "ETARGET",
]);

/**
 * True when a failed install looks like npm CDN/packument propagation lag for
 * the just-published version: the registry query already saw the version, but
 * a separate metadata fetch was served a stale document. Any other failure is
 * not retried.
 *
 * @param {{ status: number | null; timedOut?: boolean; stdout?: string; stderr?: string }} result
 */
export function isRegistryPropagationLag(result) {
  if (result.status === 0 || result.timedOut) {
    return false;
  }
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  return (
    output.includes(PUBLIC_CLI_PACKAGE_NAME) &&
    REGISTRY_LAG_SIGNATURES.some((signature) => output.includes(signature))
  );
}

/**
 * @param {{
 *   harness: string;
 *   version: string;
 *   repoRoot: string;
 * }} options
 */
export function assertInstalledRegistryPackage(options) {
  const installedPackage = path.join(options.harness, "node_modules", "@blitzcraftlabs", "atlas");
  if (!existsSync(installedPackage)) {
    throw new Error(`Registry install did not materialize ${PUBLIC_CLI_PACKAGE_NAME}`);
  }

  const installedRoot = realpathSync(installedPackage);
  assertOutsideRepo(options.repoRoot, installedRoot, `Installed ${PUBLIC_CLI_PACKAGE_NAME}`);
  if (isInsideDirectory(path.join(options.repoRoot, "packages", "cli"), installedRoot)) {
    throw new Error("Installed CLI resolved to the source-tree package");
  }

  const manifest = JSON.parse(readFileSync(path.join(installedPackage, "package.json"), "utf8"));
  if (manifest.name !== PUBLIC_CLI_PACKAGE_NAME) {
    throw new Error(`Installed package name is ${String(manifest.name)}`);
  }
  if (manifest.version !== options.version) {
    throw new Error(
      `Installed version is ${String(manifest.version)}, expected ${options.version} from npm`
    );
  }

  const bin = path.join(options.harness, "node_modules", ".bin", "atlas");
  if (!existsSync(bin)) {
    throw new Error("Installed atlas binary is missing");
  }
  if ((statSync(bin).mode & 0o111) === 0) {
    throw new Error("Installed atlas binary is not executable");
  }
  assertOutsideRepo(options.repoRoot, bin, "Installed Atlas binary");

  return {
    installedPackage: installedRoot,
    atlasBin: realpathSync(bin),
    registryUrl: NPM_REGISTRY_URL,
  };
}
