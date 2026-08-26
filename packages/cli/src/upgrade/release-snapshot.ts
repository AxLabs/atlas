import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { computeBaselineChecksum } from "@atlas/project";

import { CliError, CliErrorCode } from "../errors/cli-error";
import { SUPPORTED_APP_INFRASTRUCTURE_MANIFEST_SCHEMA_VERSION } from "../template-sync/manifest";

import type { UpgradeSnapshot } from "./types";

export const RELEASE_SNAPSHOT_FILENAME = "release.snapshot.json";
export const RELEASE_SNAPSHOT_SCHEMA_VERSION = 1;

export interface ReleaseSnapshotManifest {
  schemaVersion: number;
  atlasVersion: string;
  contractSchemaVersion: number;
  templateManifestSchemaVersion: number;
  canonicalApplication: string;
  syncedPaths: string[];
  generatedPaths: string[];
  independentPaths: string[];
  packageVersions: Record<string, string>;
  openApiSpecRelativePath?: string;
}

export interface LoadedReleaseSnapshot {
  manifest: ReleaseSnapshotManifest;
  snapshot: UpgradeSnapshot;
  releaseRoot: string;
}

const DEFAULT_RELEASES_DIR = "releases";

function readJsonFile<T>(absolutePath: string, label: string): T {
  if (!existsSync(absolutePath)) {
    throw new CliError(CliErrorCode.UPGRADE_PREREQUISITE, `Missing ${label} at ${absolutePath}.`);
  }

  try {
    return JSON.parse(readFileSync(absolutePath, "utf8")) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `${label} contains invalid JSON: ${message}`
    );
  }
}

function validateReleaseSnapshotManifest(raw: unknown): ReleaseSnapshotManifest {
  if (typeof raw !== "object" || raw === null) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `${RELEASE_SNAPSHOT_FILENAME} must be a JSON object.`
    );
  }

  const record = raw as Record<string, unknown>;

  if (record.schemaVersion !== RELEASE_SNAPSHOT_SCHEMA_VERSION) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `Unsupported release snapshot schemaVersion: ${String(record.schemaVersion)}. Expected ${RELEASE_SNAPSHOT_SCHEMA_VERSION}.`
    );
  }

  const atlasVersion = readNonEmptyString(record.atlasVersion, "atlasVersion");
  const contractSchemaVersion = readPositiveInteger(
    record.contractSchemaVersion,
    "contractSchemaVersion"
  );
  const templateManifestSchemaVersion = readPositiveInteger(
    record.templateManifestSchemaVersion,
    "templateManifestSchemaVersion"
  );
  const canonicalApplication = readNonEmptyString(
    record.canonicalApplication,
    "canonicalApplication"
  );

  const syncedPaths = readStringArray(record.syncedPaths, "syncedPaths");
  const generatedPaths = readStringArray(record.generatedPaths, "generatedPaths");
  const independentPaths = readStringArray(record.independentPaths, "independentPaths");

  const packageVersions = readPackageVersions(record.packageVersions);

  const openApiSpecRelativePath =
    record.openApiSpecRelativePath === undefined
      ? undefined
      : readNonEmptyString(record.openApiSpecRelativePath, "openApiSpecRelativePath");

  return {
    schemaVersion: RELEASE_SNAPSHOT_SCHEMA_VERSION,
    atlasVersion,
    contractSchemaVersion,
    templateManifestSchemaVersion,
    canonicalApplication,
    syncedPaths,
    generatedPaths,
    independentPaths,
    packageVersions,
    openApiSpecRelativePath,
  };
}

function readNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `Release snapshot requires a non-empty string for ${field}.`
    );
  }

  return value;
}

function readPositiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `Release snapshot requires a positive integer for ${field}.`
    );
  }

  return value;
}

function readStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `Release snapshot requires ${field} to be an array.`
    );
  }

  const entries: string[] = [];
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new CliError(
        CliErrorCode.UPGRADE_PREREQUISITE,
        `Release snapshot ${field}[${index}] must be a non-empty string.`
      );
    }
    entries.push(entry);
  }

  return entries;
}

function readPackageVersions(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      "Release snapshot requires packageVersions to be an object."
    );
  }

  const versions: Record<string, string> = {};
  for (const [packageName, version] of Object.entries(value as Record<string, unknown>)) {
    if (typeof version !== "string" || version.trim().length === 0) {
      throw new CliError(
        CliErrorCode.UPGRADE_PREREQUISITE,
        `Release snapshot packageVersions["${packageName}"] must be a non-empty version string.`
      );
    }
    versions[packageName] = version;
  }

  return versions;
}

function readReleaseFile(
  releaseRoot: string,
  canonicalApplication: string,
  relativePath: string
): string {
  const absolutePath = path.join(releaseRoot, canonicalApplication, relativePath);
  if (!existsSync(absolutePath)) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `Release snapshot is missing file ${path.posix.join(canonicalApplication, relativePath)} under ${releaseRoot}.`
    );
  }

  return readFileSync(absolutePath, "utf8");
}

function buildUpgradeSnapshotFromRelease(
  releaseRoot: string,
  manifest: ReleaseSnapshotManifest
): UpgradeSnapshot {
  const syncedPaths: Record<string, string> = {};
  const allSyncedLikePaths = [...manifest.syncedPaths, ...manifest.independentPaths].sort(
    (left, right) => left.localeCompare(right)
  );

  for (const relativePath of allSyncedLikePaths) {
    syncedPaths[relativePath] = readReleaseFile(
      releaseRoot,
      manifest.canonicalApplication,
      relativePath
    );
  }

  const generatedPaths: Record<string, string> = {};
  for (const relativePath of manifest.generatedPaths) {
    generatedPaths[relativePath] = readReleaseFile(
      releaseRoot,
      manifest.canonicalApplication,
      relativePath
    );
  }

  let openApiSpec: string | undefined;
  if (manifest.openApiSpecRelativePath) {
    const openApiPath = path.join(releaseRoot, manifest.openApiSpecRelativePath);
    if (!existsSync(openApiPath)) {
      throw new CliError(
        CliErrorCode.UPGRADE_PREREQUISITE,
        `Release snapshot is missing OpenAPI spec at ${manifest.openApiSpecRelativePath}.`
      );
    }
    openApiSpec = readFileSync(openApiPath, "utf8");
  }

  return {
    syncedPaths,
    generatedPaths,
    openApiSpec,
  };
}

export function resolveReleaseDirectory(
  repoRoot: string,
  atlasVersion: string,
  releasesDir?: string
): string {
  const baseDir = releasesDir ?? path.join(repoRoot, DEFAULT_RELEASES_DIR);
  const releaseRoot = path.join(baseDir, atlasVersion);

  if (!existsSync(path.join(releaseRoot, RELEASE_SNAPSHOT_FILENAME))) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `No release snapshot found for Atlas version ${atlasVersion}. Expected ${path.join(releaseRoot, RELEASE_SNAPSHOT_FILENAME)}.`
    );
  }

  return releaseRoot;
}

export function loadReleaseSnapshot(options: {
  repoRoot: string;
  atlasVersion: string;
  releasesDir?: string;
}): LoadedReleaseSnapshot {
  const releaseRoot = resolveReleaseDirectory(
    options.repoRoot,
    options.atlasVersion,
    options.releasesDir
  );
  const manifestPath = path.join(releaseRoot, RELEASE_SNAPSHOT_FILENAME);
  const manifest = validateReleaseSnapshotManifest(
    readJsonFile(manifestPath, RELEASE_SNAPSHOT_FILENAME)
  );

  if (manifest.atlasVersion !== options.atlasVersion) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `Release snapshot atlasVersion (${manifest.atlasVersion}) does not match requested version (${options.atlasVersion}).`
    );
  }

  const snapshot = buildUpgradeSnapshotFromRelease(releaseRoot, manifest);

  return {
    manifest,
    snapshot,
    releaseRoot,
  };
}

export function computeGeneratorInputChecksum(
  snapshot: UpgradeSnapshot,
  relativePath: string
): string {
  const generatedContent = snapshot.generatedPaths?.[relativePath];
  if (generatedContent === undefined) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `Release snapshot does not include generated path ${relativePath}.`
    );
  }

  return computeBaselineChecksum(generatedContent);
}

export function buildManifestSubsetFromRelease(manifest: ReleaseSnapshotManifest) {
  return {
    schemaVersion: SUPPORTED_APP_INFRASTRUCTURE_MANIFEST_SCHEMA_VERSION,
    canonicalApplication: manifest.canonicalApplication,
    consumerApplications: [],
    syncedPaths: manifest.syncedPaths,
    generatedPaths: manifest.generatedPaths,
    independentPaths: {},
    referenceOnlyPaths: [],
    starterOnlyPaths: [],
  };
}
