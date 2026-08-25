import {
  buildPlatformBaseline,
  captureSyncedPathChecksums,
  type PlatformBaseline,
  type RawAtlasProjectContract,
  readPlatformBaseline,
} from "@atlas/project";

import { SUPPORTED_APP_INFRASTRUCTURE_MANIFEST_SCHEMA_VERSION } from "../template-sync/manifest";

import type { AppInfrastructureManifest } from "../template-sync/manifest";

export function captureConsumerPlatformBaseline(options: {
  repoRoot: string;
  applicationRoot: string;
  atlasVersion: string;
  contractSchemaVersion: number;
  manifest: AppInfrastructureManifest;
}): PlatformBaseline {
  const syncedPathChecksums = captureSyncedPathChecksums({
    repoRoot: options.repoRoot,
    applicationRoot: options.applicationRoot,
    syncedPaths: options.manifest.syncedPaths,
  });

  return buildPlatformBaseline({
    atlasVersion: options.atlasVersion,
    contractSchemaVersion: options.contractSchemaVersion,
    templateManifestSchemaVersion: SUPPORTED_APP_INFRASTRUCTURE_MANIFEST_SCHEMA_VERSION,
    syncedPathChecksums,
  });
}

export function mergePlatformBaselineIntoContract(
  contract: RawAtlasProjectContract,
  baseline: PlatformBaseline
): RawAtlasProjectContract {
  return {
    ...contract,
    platform: {
      baseline,
    },
  };
}

export function readContractPlatformBaseline(
  contract: RawAtlasProjectContract
): PlatformBaseline | undefined {
  return readPlatformBaseline(contract);
}
