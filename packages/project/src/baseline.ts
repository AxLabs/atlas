import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { joinRepoPath } from "./paths";

import type { PlatformBaseline, RawAtlasProjectContract } from "./schema";

export const BASELINE_CHECKSUM_PREFIX = "sha256:";

/** SHA-256 baseline checksum: `sha256:` + 64 hex digits (case-insensitive on input). */
export const BASELINE_CHECKSUM_PATTERN = /^sha256:[a-fA-F0-9]{64}$/;

export type SyncedPathBaselineStatus = "unchanged" | "modified" | "unknown";

export class AtlasBaselineCaptureError extends Error {
  readonly missingPaths: string[];

  constructor(missingPaths: string[]) {
    const listed = missingPaths.join(", ");
    super(
      `Baseline capture is incomplete: ${missingPaths.length} manifest synced path(s) are missing on disk (${listed}). ` +
        "Restore the expected files or remove them from templates/app-infrastructure.manifest.json syncedPaths before recording platform.baseline."
    );
    this.name = "AtlasBaselineCaptureError";
    this.missingPaths = missingPaths;
  }
}

export function computeBaselineChecksum(content: Buffer | string): string {
  const buffer = typeof content === "string" ? Buffer.from(content) : content;
  return `${BASELINE_CHECKSUM_PREFIX}${createHash("sha256").update(buffer).digest("hex")}`;
}

export function isValidBaselineChecksum(value: string): boolean {
  return normalizeBaselineChecksum(value) !== null;
}

/** Normalize a valid checksum to lowercase hex. Returns null when the format is invalid. */
export function normalizeBaselineChecksum(value: string): string | null {
  const match = value.match(/^sha256:([a-fA-F0-9]{64})$/);
  if (!match) {
    return null;
  }

  const hex = match[1];
  if (!hex) {
    return null;
  }

  return `${BASELINE_CHECKSUM_PREFIX}${hex.toLowerCase()}`;
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

export interface CaptureSyncedPathChecksumsResult {
  checksums: Record<string, string>;
  missingPaths: string[];
  isComplete: boolean;
}

/** Capture deterministic checksums for manifest-synced paths relative to an application root. */
export function captureSyncedPathChecksums(
  options: CaptureBaselineChecksumsOptions
): CaptureSyncedPathChecksumsResult {
  const checksums: Record<string, string> = {};
  const missingPaths: string[] = [];

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
    } else {
      missingPaths.push(relativePath);
    }
  }

  return {
    checksums,
    missingPaths,
    isComplete: missingPaths.length === 0,
  };
}

/**
 * Capture synced-path checksums and fail when any manifest synced path is missing.
 * Use for canonical Atlas checkouts and `atlas init` baseline recording.
 */
export function captureSyncedPathChecksumsStrict(
  options: CaptureBaselineChecksumsOptions
): Record<string, string> {
  const result = captureSyncedPathChecksums(options);
  if (!result.isComplete) {
    throw new AtlasBaselineCaptureError(result.missingPaths);
  }

  return result.checksums;
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

export interface SyncedPathBaselineStatusOptions {
  relativePath: string;
  consumerApplicationRoot: string;
  baselineChecksums: Record<string, string>;
  consumerContent?: string;
}

/**
 * Compare a consumer synced path against recorded baseline checksum evidence.
 *
 * - `unchanged` — baseline checksum exists, is valid, consumer file exists, and checksums match.
 * - `modified` — baseline checksum exists and is valid, but consumer checksum differs.
 * - `unknown` — missing/invalid baseline checksum, missing consumer file, or indeterminate evidence.
 */
export function getSyncedPathBaselineStatus(
  options: SyncedPathBaselineStatusOptions
): SyncedPathBaselineStatus {
  const baselineChecksum = options.baselineChecksums[options.relativePath];
  if (!baselineChecksum) {
    return "unknown";
  }

  const normalizedBaseline = normalizeBaselineChecksum(baselineChecksum);
  if (!normalizedBaseline) {
    return "unknown";
  }

  let consumerChecksum: string | null;
  if (options.consumerContent !== undefined) {
    consumerChecksum = computeBaselineChecksum(options.consumerContent);
  } else {
    const consumerPath = path.join(options.consumerApplicationRoot, options.relativePath);
    consumerChecksum = readFileBaselineChecksum(consumerPath);
  }

  if (!consumerChecksum) {
    return "unknown";
  }

  return consumerChecksum === normalizedBaseline ? "unchanged" : "modified";
}

/** Returns true only when consumer modification is proven (not when baseline evidence is missing). */
export function hasConsumerModifiedSyncedPath(options: {
  relativePath: string;
  consumerApplicationRoot: string;
  baselineChecksums: Record<string, string>;
}): boolean {
  return getSyncedPathBaselineStatus(options) === "modified";
}

export interface BaselineIntegrityIssue {
  kind:
    | "missing-synced-path"
    | "invalid-checksum"
    | "stale-baseline-entry"
    | "manifest-schema-mismatch";
  relativePath?: string;
  message: string;
}

export interface ValidatePlatformBaselineIntegrityOptions {
  baseline: PlatformBaseline;
  expectedSyncedPaths: string[];
  currentManifestSchemaVersion: number;
}

/** Structural baseline integrity checks beyond generic contract schema validation. */
export function validatePlatformBaselineIntegrity(
  options: ValidatePlatformBaselineIntegrityOptions
): BaselineIntegrityIssue[] {
  const issues: BaselineIntegrityIssue[] = [];
  const expectedSyncedPaths = [...options.expectedSyncedPaths].sort((left, right) =>
    left.localeCompare(right)
  );
  const recordedPaths = Object.keys(options.baseline.syncedPathChecksums).sort((left, right) =>
    left.localeCompare(right)
  );

  if (options.baseline.templateManifestSchemaVersion !== options.currentManifestSchemaVersion) {
    issues.push({
      kind: "manifest-schema-mismatch",
      message: `Recorded template manifest schema version ${options.baseline.templateManifestSchemaVersion} differs from current manifest schema version ${options.currentManifestSchemaVersion}.`,
    });
  }

  for (const relativePath of expectedSyncedPaths) {
    const checksum = options.baseline.syncedPathChecksums[relativePath];
    if (!checksum) {
      issues.push({
        kind: "missing-synced-path",
        relativePath,
        message: `Baseline is missing checksum evidence for manifest synced path ${relativePath}.`,
      });
      continue;
    }

    if (!isValidBaselineChecksum(checksum)) {
      issues.push({
        kind: "invalid-checksum",
        relativePath,
        message: `Baseline checksum for ${relativePath} is malformed. Expected sha256:<64 hex characters>.`,
      });
    }
  }

  const expectedSet = new Set(expectedSyncedPaths);
  for (const relativePath of recordedPaths) {
    if (!expectedSet.has(relativePath)) {
      issues.push({
        kind: "stale-baseline-entry",
        relativePath,
        message: `Baseline records checksum for ${relativePath}, which is not a current manifest synced path.`,
      });
    }
  }

  return issues;
}
