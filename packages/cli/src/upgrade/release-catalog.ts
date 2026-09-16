import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { CliError, CliErrorCode } from "../errors/cli-error";
import { CLI_PACKAGE_NAME } from "../version";

import {
  PRODUCTION_RELEASE_SUPPORT_POLICY,
  REHEARSAL_ONLY_ATLAS_VERSIONS,
  RELEASE_CATALOG_FILENAME,
  RELEASE_CATALOG_SCHEMA_VERSION,
} from "./release-constants";
import { compareAtlasVersions } from "./version-compare";

export interface ProductionReleaseCatalog {
  schemaVersion: typeof RELEASE_CATALOG_SCHEMA_VERSION;
  policy: typeof PRODUCTION_RELEASE_SUPPORT_POLICY;
  current: string;
  supportedVersions: string[];
  rehearsalOnlyVersions: string[];
}

export function isRehearsalOnlyAtlasVersion(version: string): boolean {
  return (REHEARSAL_ONLY_ATLAS_VERSIONS as readonly string[]).includes(version);
}

export function sortAtlasVersions(versions: string[]): string[] {
  return [...versions].sort((left, right) => compareAtlasVersions(left, right));
}

/**
 * Current Atlas release plus the immediately previous production snapshot, when one exists.
 * Adjacent upgrades only. Rehearsal versions are never eligible.
 */
export function selectSupportedReleaseWindow(
  currentVersion: string,
  availableVersions: string[]
): string[] {
  const available = sortAtlasVersions(
    [...new Set(availableVersions)].filter((version) => !isRehearsalOnlyAtlasVersion(version))
  );

  if (!available.includes(currentVersion)) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `Production release catalog cannot include Atlas ${currentVersion} because no production snapshot exists for that version.`
    );
  }

  const previous = [...available]
    .filter((version) => compareAtlasVersions(version, currentVersion) < 0)
    .at(-1);

  return previous ? [previous, currentVersion] : [currentVersion];
}

export function buildProductionReleaseCatalog(options: {
  currentVersion: string;
  availableVersions: string[];
}): ProductionReleaseCatalog {
  const supportedVersions = selectSupportedReleaseWindow(
    options.currentVersion,
    options.availableVersions
  );

  for (const version of supportedVersions) {
    if (isRehearsalOnlyAtlasVersion(version)) {
      throw new CliError(
        CliErrorCode.UPGRADE_PREREQUISITE,
        `Rehearsal Atlas ${version} cannot be listed as production upgrade support.`
      );
    }
  }

  return {
    schemaVersion: RELEASE_CATALOG_SCHEMA_VERSION,
    policy: PRODUCTION_RELEASE_SUPPORT_POLICY,
    current: options.currentVersion,
    supportedVersions,
    rehearsalOnlyVersions: [...REHEARSAL_ONLY_ATLAS_VERSIONS],
  };
}

export function serializeProductionReleaseCatalog(catalog: ProductionReleaseCatalog): string {
  return `${JSON.stringify(catalog, null, 2)}\n`;
}

export function parseProductionReleaseCatalog(
  raw: unknown,
  catalogPath: string
): ProductionReleaseCatalog {
  if (typeof raw !== "object" || raw === null) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `Packaged release catalog at ${catalogPath} must be a JSON object.`
    );
  }

  const record = raw as Record<string, unknown>;
  if (record.schemaVersion !== RELEASE_CATALOG_SCHEMA_VERSION) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `Unsupported packaged release catalog schemaVersion at ${catalogPath}: ${String(record.schemaVersion)}. Expected ${RELEASE_CATALOG_SCHEMA_VERSION}.`
    );
  }

  if (record.policy !== PRODUCTION_RELEASE_SUPPORT_POLICY) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `Unsupported packaged release catalog policy at ${catalogPath}: ${String(record.policy)}.`
    );
  }

  const current = readNonEmptyString(record.current, "current", catalogPath);
  const supportedVersions = readVersionArray(
    record.supportedVersions,
    "supportedVersions",
    catalogPath
  );
  const rehearsalOnlyVersions = readVersionArray(
    record.rehearsalOnlyVersions,
    "rehearsalOnlyVersions",
    catalogPath
  );

  if (!supportedVersions.includes(current)) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `Packaged release catalog current version ${current} is missing from supportedVersions.`
    );
  }

  if (supportedVersions.some((version) => isRehearsalOnlyAtlasVersion(version))) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `Packaged release catalog must not treat rehearsal 0.1.0/0.2.0 snapshots as production support.`
    );
  }

  return {
    schemaVersion: RELEASE_CATALOG_SCHEMA_VERSION,
    policy: PRODUCTION_RELEASE_SUPPORT_POLICY,
    current,
    supportedVersions: sortAtlasVersions(supportedVersions),
    rehearsalOnlyVersions,
  };
}

export function readProductionReleaseCatalogFile(catalogPath: string): ProductionReleaseCatalog {
  if (!existsSync(catalogPath)) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `Packaged Atlas release catalog is missing at ${catalogPath}. Reinstall ${CLI_PACKAGE_NAME}; atlas upgrade does not load consumer repository releases/.`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(catalogPath, "utf8")) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `Packaged release catalog at ${catalogPath} contains invalid JSON: ${message}`
    );
  }

  return parseProductionReleaseCatalog(parsed, catalogPath);
}

export function formatUnsupportedSourceReleaseMessage(
  sourceVersion: string,
  catalog: ProductionReleaseCatalog
): string {
  return `Unsupported source Atlas release ${sourceVersion}. ${CLI_PACKAGE_NAME} supports adjacent upgrades among: ${formatSupportedVersions(catalog)}. Rehearsal snapshots ${REHEARSAL_ONLY_ATLAS_VERSIONS.join("/")} are not production support.`;
}

export function formatUnsupportedTargetReleaseMessage(
  targetVersion: string,
  catalog: ProductionReleaseCatalog
): string {
  return `Unsupported target Atlas release ${targetVersion}. ${CLI_PACKAGE_NAME} supports adjacent upgrades among: ${formatSupportedVersions(catalog)}. Rehearsal snapshots ${REHEARSAL_ONLY_ATLAS_VERSIONS.join("/")} are not production support.`;
}

export function catalogSupportsVersion(
  catalog: ProductionReleaseCatalog,
  version: string
): boolean {
  return catalog.supportedVersions.includes(version);
}

function formatSupportedVersions(catalog: ProductionReleaseCatalog): string {
  return catalog.supportedVersions.join(", ");
}

function readNonEmptyString(value: unknown, field: string, catalogPath: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `Packaged release catalog at ${catalogPath} requires a non-empty string for ${field}.`
    );
  }

  return value;
}

function readVersionArray(value: unknown, field: string, catalogPath: string): string[] {
  if (!Array.isArray(value)) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `Packaged release catalog at ${catalogPath} requires ${field} to be an array.`
    );
  }

  return value.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new CliError(
        CliErrorCode.UPGRADE_PREREQUISITE,
        `Packaged release catalog at ${catalogPath} ${field}[${index}] must be a non-empty version string.`
      );
    }
    return entry;
  });
}

export function catalogFilePath(releasesRoot: string): string {
  return path.join(releasesRoot, RELEASE_CATALOG_FILENAME);
}
