import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { findCliPackageRoot } from "../version";

import { BootstrapAssetError } from "./errors";
import { resolveContainedPath } from "./paths";

import type { PackagedCapabilitiesManifest } from "../enable/types";

export const PACKAGED_CAPABILITIES_ASSET_ROOT_SEGMENTS = ["assets", "capabilities"] as const;
export const PACKAGED_CAPABILITIES_MANIFEST_NAME = "manifest.json";
export const PACKAGED_CAPABILITIES_FILES_DIR = "files";
export const CAPABILITIES_MANIFEST_SCHEMA_VERSION = 1 as const;

export function packagedCapabilitiesAssetRoot(packageRoot: string): string {
  return path.join(packageRoot, ...PACKAGED_CAPABILITIES_ASSET_ROOT_SEGMENTS);
}

export function packagedCapabilitiesManifestPath(assetRoot: string): string {
  return path.join(assetRoot, PACKAGED_CAPABILITIES_MANIFEST_NAME);
}

export function packagedCapabilitiesFilesRoot(assetRoot: string): string {
  return path.join(assetRoot, PACKAGED_CAPABILITIES_FILES_DIR);
}

export function findCapabilitiesAssetRoot(startDir = __dirname): string {
  const packageRoot = findCliPackageRoot(startDir);
  const assetRoot = packagedCapabilitiesAssetRoot(packageRoot);
  const manifestPath = packagedCapabilitiesManifestPath(assetRoot);
  if (!existsSync(manifestPath)) {
    throw new BootstrapAssetError(
      `Unable to locate packaged Atlas capability manifest at ${manifestPath}.`
    );
  }
  return assetRoot;
}

export function readCapabilitiesManifest(
  assetRoot = findCapabilitiesAssetRoot()
): PackagedCapabilitiesManifest {
  const manifestPath = packagedCapabilitiesManifestPath(assetRoot);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    throw new BootstrapAssetError(
      `Packaged capability manifest contains invalid JSON (${manifestPath}): ${message}`
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new BootstrapAssetError("Packaged capability manifest must be an object.");
  }

  const manifest = parsed as PackagedCapabilitiesManifest;
  if (manifest.schemaVersion !== CAPABILITIES_MANIFEST_SCHEMA_VERSION) {
    throw new BootstrapAssetError("Unsupported packaged capability manifest schemaVersion.");
  }
  if (!Array.isArray(manifest.capabilities)) {
    throw new BootstrapAssetError("Packaged capability manifest is missing capabilities[].");
  }
  return manifest;
}

export function resolveCapabilityFile(
  capabilityId: string,
  destination: string,
  assetRoot = findCapabilitiesAssetRoot()
): string {
  const filesRoot = packagedCapabilitiesFilesRoot(assetRoot);
  return resolveContainedPath(path.join(filesRoot, capabilityId), destination, "capability asset");
}
