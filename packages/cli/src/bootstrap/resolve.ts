import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

import { findCliPackageRoot } from "../version";

import {
  PACKAGED_BOOTSTRAP_ASSET_ROOT_SEGMENTS,
  PACKAGED_BOOTSTRAP_FILES_DIR,
  PACKAGED_BOOTSTRAP_MANIFEST_NAME,
} from "./constants";
import { BootstrapAssetError } from "./errors";
import { resolveContainedPath } from "./paths";
import {
  type PackagedBootstrapManifest,
  type PackagedBootstrapManifestEntry,
  parsePackagedBootstrapManifest,
} from "./schema";

export function packagedBootstrapAssetRoot(packageRoot: string): string {
  return path.join(packageRoot, ...PACKAGED_BOOTSTRAP_ASSET_ROOT_SEGMENTS);
}

export function packagedBootstrapManifestPath(assetRoot: string): string {
  return path.join(assetRoot, PACKAGED_BOOTSTRAP_MANIFEST_NAME);
}

export function packagedBootstrapFilesRoot(assetRoot: string): string {
  return path.join(assetRoot, PACKAGED_BOOTSTRAP_FILES_DIR);
}

/**
 * Locate packaged bootstrap assets from a file inside the installed `@blitzcraftlabs/atlas`
 * package. Does not consult process.cwd(), Git metadata, or the Atlas repo root.
 */
export function findBootstrapAssetRoot(startDir = __dirname): string {
  const packageRoot = findCliPackageRoot(startDir);
  const assetRoot = packagedBootstrapAssetRoot(packageRoot);
  const manifestPath = packagedBootstrapManifestPath(assetRoot);

  if (!existsSync(manifestPath)) {
    throw new BootstrapAssetError(
      `Unable to locate packaged Atlas bootstrap manifest at ${manifestPath}.`
    );
  }

  if (!existsSync(packagedBootstrapFilesRoot(assetRoot))) {
    throw new BootstrapAssetError(
      `Unable to locate packaged Atlas bootstrap files at ${packagedBootstrapFilesRoot(assetRoot)}.`
    );
  }

  return assetRoot;
}

export function readBootstrapManifest(
  assetRoot = findBootstrapAssetRoot()
): PackagedBootstrapManifest {
  const manifestPath = packagedBootstrapManifestPath(assetRoot);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    throw new BootstrapAssetError(
      `Packaged bootstrap manifest contains invalid JSON (${manifestPath}): ${message}`
    );
  }

  return parsePackagedBootstrapManifest(parsed);
}

export function resolveBootstrapAsset(
  destination: string,
  assetRoot = findBootstrapAssetRoot()
): { absolutePath: string; entry: PackagedBootstrapManifestEntry } {
  const manifest = readBootstrapManifest(assetRoot);
  const entry = manifest.entries.find((candidate) => candidate.destination === destination);
  if (!entry) {
    throw new BootstrapAssetError(
      `Packaged bootstrap asset "${destination}" is not listed in the manifest.`
    );
  }

  const filesRoot = packagedBootstrapFilesRoot(assetRoot);
  const absolutePath = resolveContainedPath(filesRoot, entry.destination, "bootstrap asset");
  if (!existsSync(absolutePath)) {
    throw new BootstrapAssetError(
      `Packaged bootstrap asset "${entry.destination}" is missing at ${absolutePath}.`
    );
  }

  const fileStat = statSync(absolutePath);
  if (!fileStat.isFile()) {
    throw new BootstrapAssetError(
      `Packaged bootstrap asset "${entry.destination}" is not a regular file.`
    );
  }

  const realFile = realpathSync(absolutePath);
  const realFilesRoot = realpathSync(filesRoot);
  if (realFile !== realFilesRoot && !realFile.startsWith(`${realFilesRoot}${path.sep}`)) {
    throw new BootstrapAssetError(
      `Packaged bootstrap asset "${entry.destination}" resolves outside the packaged asset root.`
    );
  }

  return { absolutePath, entry };
}
