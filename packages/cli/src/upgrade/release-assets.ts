import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { CliError, CliErrorCode } from "../errors/cli-error";
import { CLI_PACKAGE_NAME, findCliPackageRoot } from "../version";

import {
  catalogFilePath,
  catalogSupportsVersion,
  formatUnsupportedSourceReleaseMessage,
  formatUnsupportedTargetReleaseMessage,
  type ProductionReleaseCatalog,
  readProductionReleaseCatalogFile,
} from "./release-catalog";
import {
  PACKAGED_RELEASE_ASSET_ROOT_SEGMENTS,
  RELEASE_SNAPSHOT_FILENAME,
  SOURCE_PRODUCTION_RELEASES_RELATIVE_PATH,
} from "./release-constants";

export function packagedReleaseAssetRoot(packageRoot: string): string {
  return path.join(packageRoot, ...PACKAGED_RELEASE_ASSET_ROOT_SEGMENTS);
}

export function sourceProductionReleasesRoot(packageRoot: string): string {
  return path.join(packageRoot, SOURCE_PRODUCTION_RELEASES_RELATIVE_PATH);
}

/**
 * Locate packaged production release assets from a file inside the installed
 * `@blitzcraftlabs/atlas` package. Does not consult process.cwd(), Git metadata, or a consumer
 * repository `releases/` tree.
 */
export function findReleaseAssetRoot(startDir = __dirname): string {
  const packageRoot = findCliPackageRoot(startDir);
  const assetRoot = packagedReleaseAssetRoot(packageRoot);
  const catalogPath = catalogFilePath(assetRoot);

  if (!existsSync(catalogPath)) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `Packaged Atlas release catalog is missing at ${catalogPath}. Reinstall ${CLI_PACKAGE_NAME}; atlas upgrade does not load consumer repository releases/.`
    );
  }

  return assetRoot;
}

export function readPackagedReleaseCatalog(
  assetRoot = findReleaseAssetRoot()
): ProductionReleaseCatalog {
  return readProductionReleaseCatalogFile(catalogFilePath(assetRoot));
}

export function assertPackagedReleaseSupported(options: {
  sourceVersion: string;
  targetVersion: string;
  catalog: ProductionReleaseCatalog;
}): void {
  if (!catalogSupportsVersion(options.catalog, options.sourceVersion)) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      formatUnsupportedSourceReleaseMessage(options.sourceVersion, options.catalog)
    );
  }

  if (!catalogSupportsVersion(options.catalog, options.targetVersion)) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      formatUnsupportedTargetReleaseMessage(options.targetVersion, options.catalog)
    );
  }
}

export function listProductionSnapshotVersions(productionRoot: string): string[] {
  if (!existsSync(productionRoot)) {
    return [];
  }

  return readdirSync(productionRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d+\.\d+\.\d+$/.test(entry.name))
    .filter((entry) => existsSync(path.join(productionRoot, entry.name, RELEASE_SNAPSHOT_FILENAME)))
    .filter((entry) => statSync(path.join(productionRoot, entry.name)).isDirectory())
    .map((entry) => entry.name);
}

export {
  PACKAGED_RELEASE_ASSET_ROOT_SEGMENTS,
  SOURCE_PRODUCTION_RELEASES_RELATIVE_PATH,
} from "./release-constants";
