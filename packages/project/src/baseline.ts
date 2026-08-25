import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { joinRepoPath } from "./paths";

import type { PlatformBaseline, RawAtlasProjectContract } from "./schema";

export const BASELINE_CHECKSUM_PREFIX = "sha256:";

export function computeBaselineChecksum(content: Buffer | string): string {
  const buffer = typeof content === "string" ? Buffer.from(content) : content;
  return `${BASELINE_CHECKSUM_PREFIX}${createHash("sha256").update(buffer).digest("hex")}`;
}

export function readFileBaselineChecksum(absolutePath: string): string | null {
  if (!existsSync(absolutePath)) {
    return null;
  }

  return computeBaselineChecksum(readFileSync(absolutePath));
}

export interface CaptureBaselineChecksumsOptions {
  repoRoot: string;
  applicationRoot: string;
  syncedPaths: string[];
}

/** Capture deterministic checksums for manifest-synced paths relative to an application root. */
export function captureSyncedPathChecksums(
  options: CaptureBaselineChecksumsOptions
): Record<string, string> {
  const checksums: Record<string, string> = {};

  for (const relativePath of [...options.syncedPaths].sort((left, right) =>
    left.localeCompare(right)
  )) {
    const absolutePath = path.join(
      joinRepoPath(options.repoRoot, options.applicationRoot),
      relativePath
    );
    const checksum = readFileBaselineChecksum(absolutePath);
    if (checksum) {
      checksums[relativePath] = checksum;
    }
  }

  return checksums;
}

export interface BuildPlatformBaselineOptions {
  atlasVersion: string;
  contractSchemaVersion: number;
  templateManifestSchemaVersion: number;
  syncedPathChecksums: Record<string, string>;
}

export function buildPlatformBaseline(options: BuildPlatformBaselineOptions): PlatformBaseline {
  const syncedPathChecksums = Object.fromEntries(
    Object.entries(options.syncedPathChecksums).sort(([left], [right]) => left.localeCompare(right))
  );

  return {
    atlasVersion: options.atlasVersion,
    contractSchemaVersion: options.contractSchemaVersion,
    templateManifestSchemaVersion: options.templateManifestSchemaVersion,
    syncedPathChecksums,
  };
}

export function readPlatformBaseline(
  contract: RawAtlasProjectContract
): PlatformBaseline | undefined {
  return contract.platform?.baseline;
}

export function hasConsumerModifiedSyncedPath(options: {
  relativePath: string;
  consumerApplicationRoot: string;
  baselineChecksums: Record<string, string>;
}): boolean {
  const baselineChecksum = options.baselineChecksums[options.relativePath];
  if (!baselineChecksum) {
    return false;
  }

  const consumerPath = path.join(options.consumerApplicationRoot, options.relativePath);
  const consumerChecksum = readFileBaselineChecksum(consumerPath);
  if (!consumerChecksum) {
    return true;
  }

  return consumerChecksum !== baselineChecksum;
}
