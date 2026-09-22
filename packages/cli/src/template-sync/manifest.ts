import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { CliError, CliErrorCode } from "../errors/cli-error";

export const APP_INFRASTRUCTURE_MANIFEST_RELATIVE_PATH =
  "templates/app-infrastructure.manifest.json";

export const SUPPORTED_APP_INFRASTRUCTURE_MANIFEST_SCHEMA_VERSION = 1;

export interface AppInfrastructureManifest {
  schemaVersion: number;
  canonicalApplication: string;
  consumerApplications: string[];
  syncedPaths: string[];
  generatedPaths: string[];
  independentPaths: Record<string, Record<string, string>>;
  referenceOnlyPaths: string[];
  starterOnlyPaths: string[];
  repositorySyncedPaths: string[];
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

  if (record.schemaVersion !== SUPPORTED_APP_INFRASTRUCTURE_MANIFEST_SCHEMA_VERSION) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `Unsupported application infrastructure manifest schemaVersion: ${String(record.schemaVersion)}. Expected ${SUPPORTED_APP_INFRASTRUCTURE_MANIFEST_SCHEMA_VERSION}.`
    );
  }

  const canonicalApplication = readNonEmptyString(
    record.canonicalApplication,
    "canonicalApplication"
  );
  validateApplicationPath(canonicalApplication, "canonicalApplication");

  const consumerApplications = readNonEmptyStringArray(
    record.consumerApplications,
    "consumerApplications",
    { minLength: 0 }
  );
  for (const consumerApplication of consumerApplications) {
    validateApplicationPath(
      consumerApplication,
      `consumerApplications entry "${consumerApplication}"`
    );
  }

  if (consumerApplications.includes(canonicalApplication)) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `canonicalApplication "${canonicalApplication}" must not also appear in consumerApplications.`
    );
  }

  assertUniqueEntries(consumerApplications, "consumerApplications");

  const syncedPaths = readNonEmptyStringArray(record.syncedPaths, "syncedPaths", { minLength: 0 });
  assertUniqueEntries(syncedPaths, "syncedPaths");
  for (const syncedPath of syncedPaths) {
    validateInfrastructurePath(syncedPath, `syncedPaths entry "${syncedPath}"`);
  }

  const generatedPaths = readOptionalNonEmptyStringArray(record.generatedPaths, "generatedPaths");
  assertUniqueEntries(generatedPaths, "generatedPaths");
  for (const generatedPath of generatedPaths) {
    validateInfrastructurePath(generatedPath, `generatedPaths entry "${generatedPath}"`);
  }

  const referenceOnlyPaths = readOptionalNonEmptyStringArray(
    record.referenceOnlyPaths,
    "referenceOnlyPaths"
  );
  assertUniqueEntries(referenceOnlyPaths, "referenceOnlyPaths");
  for (const referenceOnlyPath of referenceOnlyPaths) {
    validateInfrastructurePath(
      referenceOnlyPath,
      `referenceOnlyPaths entry "${referenceOnlyPath}"`
    );
  }

  const starterOnlyPaths = readOptionalNonEmptyStringArray(
    record.starterOnlyPaths,
    "starterOnlyPaths"
  );
  assertUniqueEntries(starterOnlyPaths, "starterOnlyPaths");
  for (const starterOnlyPath of starterOnlyPaths) {
    validateInfrastructurePath(starterOnlyPath, `starterOnlyPaths entry "${starterOnlyPath}"`);
  }

  const repositorySyncedPaths = readOptionalNonEmptyStringArray(
    record.repositorySyncedPaths,
    "repositorySyncedPaths"
  );
  assertUniqueEntries(repositorySyncedPaths, "repositorySyncedPaths");
  for (const repositorySyncedPath of repositorySyncedPaths) {
    validateInfrastructurePath(
      repositorySyncedPath,
      `repositorySyncedPaths entry "${repositorySyncedPath}"`
    );
  }

  const independentPaths = readIndependentPaths(record.independentPaths, consumerApplications);

  const requiredInfrastructureModules = readOptionalNonEmptyStringArray(
    readStructuralConformance(record.structuralConformance)?.requiredInfrastructureModules,
    "structuralConformance.requiredInfrastructureModules"
  );
  assertUniqueEntries(
    requiredInfrastructureModules,
    "structuralConformance.requiredInfrastructureModules"
  );
  for (const requiredModule of requiredInfrastructureModules) {
    validateInfrastructurePath(
      requiredModule,
      `structuralConformance.requiredInfrastructureModules entry "${requiredModule}"`
    );
  }

  assertNoClassificationOverlap({
    syncedPaths,
    generatedPaths,
    referenceOnlyPaths,
    starterOnlyPaths,
    independentPaths,
  });

  for (const repositorySyncedPath of repositorySyncedPaths) {
    if (
      syncedPaths.includes(repositorySyncedPath) ||
      generatedPaths.includes(repositorySyncedPath) ||
      referenceOnlyPaths.includes(repositorySyncedPath) ||
      starterOnlyPaths.includes(repositorySyncedPath)
    ) {
      throw new CliError(
        CliErrorCode.USAGE_ERROR,
        `repositorySyncedPaths entry "${repositorySyncedPath}" must not also appear in application-level ownership lists.`
      );
    }
  }

  return {
    schemaVersion: SUPPORTED_APP_INFRASTRUCTURE_MANIFEST_SCHEMA_VERSION,
    canonicalApplication,
    consumerApplications,
    syncedPaths,
    generatedPaths,
    independentPaths,
    referenceOnlyPaths,
    starterOnlyPaths,
    repositorySyncedPaths,
    structuralConformance:
      requiredInfrastructureModules.length > 0 ? { requiredInfrastructureModules } : undefined,
  };
}

function readStructuralConformance(
  value: unknown
): { requiredInfrastructureModules?: unknown } | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "object") {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      "structuralConformance must be an object when provided."
    );
  }

  return value as { requiredInfrastructureModules?: unknown };
}

function readNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `Application infrastructure manifest requires a non-empty string for ${field}.`
    );
  }

  return value;
}

function readNonEmptyStringArray(
  value: unknown,
  field: string,
  options: { minLength: number }
): string[] {
  if (!Array.isArray(value)) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `Application infrastructure manifest requires ${field} to be an array.`
    );
  }

  if (value.length < options.minLength) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `Application infrastructure manifest requires at least ${options.minLength} ${field} entr${options.minLength === 1 ? "y" : "ies"}.`
    );
  }

  const entries: string[] = [];
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new CliError(
        CliErrorCode.USAGE_ERROR,
        `${field}[${index}] must be a non-empty string.`
      );
    }
    entries.push(entry);
  }

  return entries;
}

function readOptionalNonEmptyStringArray(value: unknown, field: string): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  return readNonEmptyStringArray(value, field, { minLength: 0 });
}

function readIndependentPaths(
  value: unknown,
  consumerApplications: string[]
): Record<string, Record<string, string>> {
  if (value === undefined || value === null) {
    return {};
  }

  if (typeof value !== "object") {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      "independentPaths must be an object keyed by consumer application."
    );
  }

  const consumerSet = new Set(consumerApplications);
  const independentPaths: Record<string, Record<string, string>> = {};

  for (const [application, pathsRecord] of Object.entries(value as Record<string, unknown>)) {
    if (!consumerSet.has(application)) {
      throw new CliError(
        CliErrorCode.USAGE_ERROR,
        `independentPaths contains unknown consumer application "${application}". Expected one of: ${consumerApplications.join(", ")}.`
      );
    }

    if (typeof pathsRecord !== "object" || pathsRecord === null) {
      throw new CliError(
        CliErrorCode.USAGE_ERROR,
        `independentPaths["${application}"] must be an object mapping relative paths to reasons.`
      );
    }

    const pathsForConsumer: Record<string, string> = {};
    for (const [relativePath, reason] of Object.entries(pathsRecord)) {
      validateInfrastructurePath(
        relativePath,
        `independentPaths["${application}"] entry "${relativePath}"`
      );

      if (typeof reason !== "string" || reason.trim().length === 0) {
        throw new CliError(
          CliErrorCode.USAGE_ERROR,
          `independentPaths["${application}"]["${relativePath}"] must be a non-empty reason string.`
        );
      }

      pathsForConsumer[relativePath] = reason;
    }

    assertUniqueEntries(Object.keys(pathsForConsumer), `independentPaths["${application}"]`);
    independentPaths[application] = pathsForConsumer;
  }

  return independentPaths;
}

function assertUniqueEntries(entries: string[], field: string): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry)) {
      throw new CliError(CliErrorCode.USAGE_ERROR, `${field} contains duplicate entry "${entry}".`);
    }
    seen.add(entry);
  }
}

function validateApplicationPath(applicationPath: string, context: string): void {
  validateRelativePath(applicationPath, context);

  const normalized = path.posix.normalize(applicationPath.replace(/\\/g, "/"));
  if (normalized === "." || normalized === "") {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `${context}: application path must not be empty or "." (${applicationPath}).`
    );
  }
}

function validateInfrastructurePath(relativePath: string, context: string): void {
  validateRelativePath(relativePath, context);

  const normalized = path.posix.normalize(relativePath.replace(/\\/g, "/"));
  if (normalized === "." || normalized === "") {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `${context}: infrastructure path must not be empty or "." (${relativePath}).`
    );
  }
}

function validateRelativePath(relativePath: string, context: string): void {
  if (relativePath.startsWith("/")) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `${context}: absolute paths are not allowed (${relativePath}).`
    );
  }

  if (/^[A-Za-z]:/.test(relativePath)) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `${context}: absolute paths are not allowed (${relativePath}).`
    );
  }

  if (relativePath.includes("..")) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `${context}: path traversal is not allowed (${relativePath}).`
    );
  }

  const normalized = path.posix.normalize(relativePath.replace(/\\/g, "/"));
  if (normalized.startsWith("../") || normalized === "..") {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `${context}: path resolves outside the application root (${relativePath}).`
    );
  }

  const segments = normalized.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `${context}: path contains empty segments (${relativePath}).`
    );
  }
}

function assertNoClassificationOverlap(classification: {
  syncedPaths: string[];
  generatedPaths: string[];
  referenceOnlyPaths: string[];
  starterOnlyPaths: string[];
  independentPaths: Record<string, Record<string, string>>;
}): void {
  const ownership = new Map<string, string>();

  const recordOwnership = (relativePath: string, category: string): void => {
    const existing = ownership.get(relativePath);
    if (existing) {
      throw new CliError(
        CliErrorCode.USAGE_ERROR,
        `Path "${relativePath}" is classified as both ${existing} and ${category}.`
      );
    }
    ownership.set(relativePath, category);
  };

  for (const syncedPath of classification.syncedPaths) {
    recordOwnership(syncedPath, "syncedPaths");
  }

  for (const generatedPath of classification.generatedPaths) {
    recordOwnership(generatedPath, "generatedPaths");
  }

  for (const referenceOnlyPath of classification.referenceOnlyPaths) {
    recordOwnership(referenceOnlyPath, "referenceOnlyPaths");
  }

  for (const starterOnlyPath of classification.starterOnlyPaths) {
    recordOwnership(starterOnlyPath, "starterOnlyPaths");
  }

  for (const [application, pathsRecord] of Object.entries(classification.independentPaths)) {
    for (const relativePath of Object.keys(pathsRecord)) {
      const existing = ownership.get(relativePath);
      if (existing) {
        throw new CliError(
          CliErrorCode.USAGE_ERROR,
          `Path "${relativePath}" is classified as both ${existing} and independentPaths["${application}"].`
        );
      }
      ownership.set(relativePath, `independentPaths["${application}"]`);
    }
  }
}

export function resolvePathUnderApplication(
  repoRoot: string,
  application: string,
  relativePath: string
): string {
  const applicationRoot = path.resolve(repoRoot, application);
  const resolvedPath = path.resolve(applicationRoot, relativePath);

  if (
    resolvedPath !== applicationRoot &&
    !resolvedPath.startsWith(`${applicationRoot}${path.sep}`)
  ) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `Path "${relativePath}" resolves outside application root "${application}".`
    );
  }

  return resolvedPath;
}
