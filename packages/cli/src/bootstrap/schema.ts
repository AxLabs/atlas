import { z } from "zod";

import {
  BOOTSTRAP_MANIFEST_SCHEMA_VERSION,
  CHECKSUM_PATTERN,
  POSIX_MODE_PATTERN,
} from "./constants";
import { BootstrapAssetError } from "./errors";
import { comparePosixPaths, normalizeGlobPattern, normalizeManifestPath } from "./paths";

export interface GeneratedAtInitEntry {
  destination: string;
  reason: string;
}

export interface SourceBootstrapManifestEntry {
  source: string;
  destination: string;
  exclude?: string[];
}

export interface SourceBootstrapManifest {
  schemaVersion: typeof BOOTSTRAP_MANIFEST_SCHEMA_VERSION;
  generatedAtInit: GeneratedAtInitEntry[];
  entries: SourceBootstrapManifestEntry[];
}

export interface PackagedBootstrapManifestEntry {
  source: string;
  destination: string;
  sha256: string;
  mode: string;
}

export interface PackagedBootstrapManifest {
  schemaVersion: typeof BOOTSTRAP_MANIFEST_SCHEMA_VERSION;
  atlasVersion: string;
  generatedAtInit: GeneratedAtInitEntry[];
  entries: PackagedBootstrapManifestEntry[];
}

const generatedAtInitSchema = z
  .object({
    destination: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();

const sourceEntrySchema = z
  .object({
    source: z.string().min(1),
    destination: z.string().min(1),
    exclude: z.array(z.string().min(1)).optional(),
  })
  .strict();

const sourceManifestSchema = z
  .object({
    schemaVersion: z.literal(BOOTSTRAP_MANIFEST_SCHEMA_VERSION),
    generatedAtInit: z.array(generatedAtInitSchema).optional(),
    entries: z.array(sourceEntrySchema).min(1),
  })
  .strict();

const packagedEntrySchema = z
  .object({
    source: z.string().min(1),
    destination: z.string().min(1),
    sha256: z.string().regex(CHECKSUM_PATTERN),
    mode: z.string().regex(POSIX_MODE_PATTERN),
  })
  .strict();

const packagedManifestSchema = z
  .object({
    schemaVersion: z.literal(BOOTSTRAP_MANIFEST_SCHEMA_VERSION),
    atlasVersion: z.string().min(1),
    generatedAtInit: z.array(generatedAtInitSchema),
    entries: z.array(packagedEntrySchema).min(1),
  })
  .strict();

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "manifest";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

function normalizeGeneratedAtInit(entries: GeneratedAtInitEntry[]): GeneratedAtInitEntry[] {
  const normalized = entries.map((entry) => ({
    destination: normalizeManifestPath(entry.destination, "generatedAtInit destination"),
    reason: entry.reason.trim(),
  }));

  const seen = new Set<string>();
  for (const entry of normalized) {
    if (seen.has(entry.destination)) {
      throw new BootstrapAssetError(
        `Duplicate generatedAtInit destination "${entry.destination}".`
      );
    }
    seen.add(entry.destination);
  }

  return [...normalized].sort((left, right) =>
    comparePosixPaths(left.destination, right.destination)
  );
}

function normalizeExclude(patterns: string[] | undefined, label: string): string[] | undefined {
  if (patterns === undefined) {
    return undefined;
  }

  const normalized = patterns.map((pattern, index) =>
    normalizeGlobPattern(pattern, `${label} exclude[${index}]`)
  );
  return normalized;
}

export function parseSourceBootstrapManifest(raw: unknown): SourceBootstrapManifest {
  const parsed = sourceManifestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BootstrapAssetError(
      `Invalid bootstrap source manifest: ${formatZodError(parsed.error)}`
    );
  }

  const entries = parsed.data.entries.map((entry, index) => {
    const source = normalizeManifestPath(entry.source, `entries[${index}].source`);
    const destination = normalizeManifestPath(entry.destination, `entries[${index}].destination`);
    const exclude = normalizeExclude(entry.exclude, `entries[${index}]`);
    return exclude === undefined ? { source, destination } : { source, destination, exclude };
  });

  const seenDestinations = new Set<string>();
  const seenSources = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    if (seenDestinations.has(entry.destination)) {
      throw new BootstrapAssetError(
        `Duplicate destination path "${entry.destination}" in source bootstrap manifest.`
      );
    }
    seenDestinations.add(entry.destination);

    const sourceKey = `${entry.source}=>${entry.destination}`;
    if (seenSources.has(sourceKey)) {
      throw new BootstrapAssetError(
        `Duplicate source bootstrap manifest entry at index ${index}: ${entry.source} -> ${entry.destination}.`
      );
    }
    seenSources.add(sourceKey);
  }

  return {
    schemaVersion: BOOTSTRAP_MANIFEST_SCHEMA_VERSION,
    generatedAtInit: normalizeGeneratedAtInit(parsed.data.generatedAtInit ?? []),
    entries,
  };
}

export function parsePackagedBootstrapManifest(raw: unknown): PackagedBootstrapManifest {
  const parsed = packagedManifestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BootstrapAssetError(
      `Invalid packaged bootstrap manifest: ${formatZodError(parsed.error)}`
    );
  }

  const entries = parsed.data.entries.map((entry, index) => ({
    source: normalizeManifestPath(entry.source, `entries[${index}].source`),
    destination: normalizeManifestPath(entry.destination, `entries[${index}].destination`),
    sha256: entry.sha256,
    mode: entry.mode,
  }));

  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.destination)) {
      throw new BootstrapAssetError(
        `Duplicate destination path "${entry.destination}" in packaged bootstrap manifest.`
      );
    }
    seen.add(entry.destination);
  }

  const sortedEntries = [...entries].sort((left, right) =>
    comparePosixPaths(left.destination, right.destination)
  );
  const expectedOrder = sortedEntries.map((entry) => entry.destination).join("\n");
  const actualOrder = entries.map((entry) => entry.destination).join("\n");
  if (expectedOrder !== actualOrder) {
    throw new BootstrapAssetError(
      "Packaged bootstrap manifest entries must be sorted by destination."
    );
  }

  return {
    schemaVersion: BOOTSTRAP_MANIFEST_SCHEMA_VERSION,
    atlasVersion: parsed.data.atlasVersion,
    generatedAtInit: normalizeGeneratedAtInit(parsed.data.generatedAtInit),
    entries: sortedEntries,
  };
}

export function serializePackagedBootstrapManifest(manifest: PackagedBootstrapManifest): string {
  const normalized = parsePackagedBootstrapManifest(manifest);
  return `${JSON.stringify(
    {
      schemaVersion: normalized.schemaVersion,
      atlasVersion: normalized.atlasVersion,
      generatedAtInit: normalized.generatedAtInit,
      entries: normalized.entries,
    },
    null,
    2
  )}\n`;
}
