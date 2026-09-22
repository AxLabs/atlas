import path from "node:path";

import {
  buildPlatformBaseline,
  captureRepositorySyncedPathChecksumsStrict,
  captureSyncedPathChecksumsStrict,
  computeBaselineChecksum,
  type PlatformBaseline,
  type RawAtlasProjectContract,
  readFileBaselineChecksum,
  readPlatformBaseline,
} from "@atlas/project";

import { SUPPORTED_APP_INFRASTRUCTURE_MANIFEST_SCHEMA_VERSION } from "../template-sync/manifest";

import type { AppInfrastructureManifest } from "../template-sync/manifest";
import type { UpgradePlanItem } from "./types";

export function captureConsumerPlatformBaseline(options: {
  repoRoot: string;
  applicationRoot: string;
  atlasVersion: string;
  contractSchemaVersion: number;
  manifest: AppInfrastructureManifest;
  repositorySyncedPathChecksums?: Record<string, string>;
}): PlatformBaseline {
  const syncedPathChecksums = captureSyncedPathChecksumsStrict({
    repoRoot: options.repoRoot,
    applicationRoot: options.applicationRoot,
    syncedPaths: options.manifest.syncedPaths,
  });

  const repositorySyncedPathChecksums =
    options.repositorySyncedPathChecksums ??
    (options.manifest.repositorySyncedPaths?.length
      ? captureRepositorySyncedPathChecksumsStrict({
          repoRoot: options.repoRoot,
          repositorySyncedPaths: options.manifest.repositorySyncedPaths,
        })
      : undefined);

  return buildPlatformBaseline({
    atlasVersion: options.atlasVersion,
    contractSchemaVersion: options.contractSchemaVersion,
    templateManifestSchemaVersion: SUPPORTED_APP_INFRASTRUCTURE_MANIFEST_SCHEMA_VERSION,
    syncedPathChecksums,
    repositorySyncedPathChecksums,
  });
}

export function selectRepositorySyncedPathChecksumsForUpgrade(options: {
  repoRoot: string;
  targetRepositorySyncedPaths: string[];
  previousChecksums: Record<string, string>;
  items: UpgradePlanItem[];
  consumerFiles: Record<string, string>;
  targetContents: Record<string, string>;
}): Record<string, string> {
  const next: Record<string, string> = {};
  const itemByPath = new Map(
    options.items
      .filter((item) => item.pathScope === "repository")
      .map((item) => [item.relativePath, item])
  );

  for (const relativePath of options.targetRepositorySyncedPaths) {
    const item = itemByPath.get(relativePath);
    if (item?.action === "manual-review") {
      continue;
    }

    if (item?.action === "create" || item?.action === "replace") {
      const diskChecksum = readFileBaselineChecksum(path.join(options.repoRoot, relativePath));
      if (diskChecksum) {
        next[relativePath] = diskChecksum;
      }
      continue;
    }

    const consumerContent = options.consumerFiles[relativePath];
    const targetContent = options.targetContents[relativePath];
    if (consumerContent !== undefined && consumerContent === targetContent) {
      next[relativePath] = computeBaselineChecksum(targetContent);
      continue;
    }

    const previous = options.previousChecksums[relativePath];
    if (previous) {
      next[relativePath] = previous;
    }
  }

  return next;
}

export function mergePlatformBaselineIntoContract(
  contract: RawAtlasProjectContract,
  baseline: PlatformBaseline
): RawAtlasProjectContract {
  return {
    ...contract,
    platform: {
      ...contract.platform,
      baseline,
    },
  };
}

export function readContractPlatformBaseline(
  contract: RawAtlasProjectContract
): PlatformBaseline | undefined {
  return readPlatformBaseline(contract);
}
