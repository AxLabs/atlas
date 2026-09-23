import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  APP_INFRASTRUCTURE_MANIFEST_RELATIVE_PATH,
  type AppInfrastructureManifest,
  loadAppInfrastructureManifest,
  resolveManifestPath,
} from "../template-sync/manifest";

export function toConsumerInfrastructureManifest(
  manifest: AppInfrastructureManifest,
  repoRoot: string
): AppInfrastructureManifest {
  const presentConsumers = manifest.consumerApplications.filter((application) =>
    existsSync(path.join(repoRoot, application))
  );

  const presentSet = new Set(presentConsumers);
  const independentPaths = Object.fromEntries(
    Object.entries(manifest.independentPaths).filter(([application]) => presentSet.has(application))
  );

  return {
    ...manifest,
    consumerApplications: presentConsumers,
    independentPaths,
  };
}

export function serializeInfrastructureManifest(manifest: AppInfrastructureManifest): string {
  return `${JSON.stringify(
    {
      schemaVersion: manifest.schemaVersion,
      canonicalApplication: manifest.canonicalApplication,
      consumerApplications: manifest.consumerApplications,
      syncedPaths: manifest.syncedPaths,
      generatedPaths: manifest.generatedPaths,
      independentPaths: manifest.independentPaths,
      referenceOnlyPaths: manifest.referenceOnlyPaths,
      starterOnlyPaths: manifest.starterOnlyPaths,
      ...(manifest.repositorySyncedPaths.length > 0
        ? { repositorySyncedPaths: manifest.repositorySyncedPaths }
        : {}),
      ...(manifest.structuralConformance
        ? { structuralConformance: manifest.structuralConformance }
        : {}),
    },
    null,
    2
  )}\n`;
}

export function normalizeGeneratedInfrastructureManifest(repoRoot: string): void {
  const manifestPath = resolveManifestPath(repoRoot);
  if (!existsSync(manifestPath)) {
    return;
  }

  const current = loadAppInfrastructureManifest(repoRoot);
  const normalized = toConsumerInfrastructureManifest(current, repoRoot);
  const next = serializeInfrastructureManifest(normalized);
  const previous = serializeInfrastructureManifest(current);
  if (next !== previous) {
    writeFileSync(manifestPath, next, "utf8");
  }
}

export { APP_INFRASTRUCTURE_MANIFEST_RELATIVE_PATH };
