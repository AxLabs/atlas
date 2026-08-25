import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { CliError, CliErrorCode } from "../errors/cli-error";

export const APP_INFRASTRUCTURE_MANIFEST_RELATIVE_PATH =
  "templates/app-infrastructure.manifest.json";

export interface AppInfrastructureManifest {
  schemaVersion: number;
  canonicalApplication: string;
  consumerApplications: string[];
  syncedPaths: string[];
  independentPaths: Record<string, Record<string, string>>;
  referenceOnlyPaths: string[];
  starterOnlyPaths: string[];
  structuralConformance?: {
    requiredInfrastructureModules?: string[];
  };
}

export function resolveManifestPath(repoRoot: string): string {
  return path.join(repoRoot, APP_INFRASTRUCTURE_MANIFEST_RELATIVE_PATH);
}

export function loadAppInfrastructureManifest(repoRoot: string): AppInfrastructureManifest {
  const manifestPath = resolveManifestPath(repoRoot);

  if (!existsSync(manifestPath)) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `Missing application infrastructure manifest at ${APP_INFRASTRUCTURE_MANIFEST_RELATIVE_PATH}.`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `Application infrastructure manifest contains invalid JSON: ${message}`
    );
  }

  return validateManifest(parsed);
}

function validateManifest(raw: unknown): AppInfrastructureManifest {
  if (typeof raw !== "object" || raw === null) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      "Application infrastructure manifest must be a JSON object."
    );
  }

  const record = raw as Record<string, unknown>;

  if (record.schemaVersion !== 1) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `Unsupported application infrastructure manifest schemaVersion: ${String(record.schemaVersion)}. Expected 1.`
    );
  }

  if (typeof record.canonicalApplication !== "string" || record.canonicalApplication.length === 0) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      "Application infrastructure manifest requires canonicalApplication."
    );
  }

  if (!Array.isArray(record.consumerApplications) || record.consumerApplications.length === 0) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      "Application infrastructure manifest requires at least one consumerApplications entry."
    );
  }

  if (!Array.isArray(record.syncedPaths)) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      "Application infrastructure manifest requires syncedPaths."
    );
  }

  return {
    schemaVersion: 1,
    canonicalApplication: record.canonicalApplication,
    consumerApplications: record.consumerApplications as string[],
    syncedPaths: record.syncedPaths as string[],
    independentPaths: (record.independentPaths as Record<string, Record<string, string>>) ?? {},
    referenceOnlyPaths: (record.referenceOnlyPaths as string[]) ?? [],
    starterOnlyPaths: (record.starterOnlyPaths as string[]) ?? [],
    structuralConformance:
      record.structuralConformance as AppInfrastructureManifest["structuralConformance"],
  };
}
