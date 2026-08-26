export interface ReleasePathManifest {
  syncedPaths: string[];
  generatedPaths: string[];
  independentPaths: string[];
}

export type SyncedPathTransitionKind = "existing" | "new" | "removed";

export type OwnershipTransitionKind =
  | "synced-to-independent"
  | "independent-to-synced"
  | "generated-introduced"
  | "generated-removed";

export interface SyncedPathTransition {
  relativePath: string;
  kind: SyncedPathTransitionKind;
}

export interface OwnershipTransition {
  relativePath: string;
  kind: OwnershipTransitionKind;
  message: string;
}

function sortedUnique(paths: string[]): string[] {
  return [...new Set(paths)].sort((left, right) => left.localeCompare(right));
}

export function classifySyncedPathTransitions(options: {
  sourceManifest: ReleasePathManifest;
  targetManifest: ReleasePathManifest;
}): SyncedPathTransition[] {
  const sourceSynced = new Set(options.sourceManifest.syncedPaths);
  const targetSynced = new Set(options.targetManifest.syncedPaths);
  const transitions: SyncedPathTransition[] = [];

  for (const relativePath of sortedUnique([
    ...options.sourceManifest.syncedPaths,
    ...options.targetManifest.syncedPaths,
  ])) {
    const inSource = sourceSynced.has(relativePath);
    const inTarget = targetSynced.has(relativePath);

    if (inSource && inTarget) {
      transitions.push({ relativePath, kind: "existing" });
    } else if (!inSource && inTarget) {
      transitions.push({ relativePath, kind: "new" });
    } else if (inSource && !inTarget) {
      transitions.push({ relativePath, kind: "removed" });
    }
  }

  return transitions;
}

export function classifyOwnershipTransitions(options: {
  sourceManifest: ReleasePathManifest;
  targetManifest: ReleasePathManifest;
}): OwnershipTransition[] {
  const transitions: OwnershipTransition[] = [];
  const sourceSynced = new Set(options.sourceManifest.syncedPaths);
  const targetSynced = new Set(options.targetManifest.syncedPaths);
  const sourceIndependent = new Set(options.sourceManifest.independentPaths);
  const targetIndependent = new Set(options.targetManifest.independentPaths);
  const sourceGenerated = new Set(options.sourceManifest.generatedPaths);
  const targetGenerated = new Set(options.targetManifest.generatedPaths);

  for (const relativePath of sortedUnique([
    ...options.sourceManifest.syncedPaths,
    ...options.targetManifest.syncedPaths,
    ...options.sourceManifest.independentPaths,
    ...options.targetManifest.independentPaths,
  ])) {
    const wasSynced = sourceSynced.has(relativePath);
    const isSynced = targetSynced.has(relativePath);
    const wasIndependent = sourceIndependent.has(relativePath);
    const isIndependent = targetIndependent.has(relativePath);

    if (wasSynced && isIndependent) {
      transitions.push({
        relativePath,
        kind: "synced-to-independent",
        message: `Atlas reclassified ${relativePath} from synced to application-owned between releases.`,
      });
    } else if (wasIndependent && isSynced) {
      transitions.push({
        relativePath,
        kind: "independent-to-synced",
        message: `Atlas reclassified ${relativePath} from application-owned to synced between releases.`,
      });
    }
  }

  for (const relativePath of sortedUnique(options.targetManifest.generatedPaths)) {
    if (!sourceGenerated.has(relativePath)) {
      transitions.push({
        relativePath,
        kind: "generated-introduced",
        message: `Atlas introduced generated path ${relativePath} in the target release.`,
      });
    }
  }

  for (const relativePath of sortedUnique(options.sourceManifest.generatedPaths)) {
    if (!targetGenerated.has(relativePath)) {
      transitions.push({
        relativePath,
        kind: "generated-removed",
        message: `Atlas removed generated path ${relativePath} from the target release manifest.`,
      });
    }
  }

  return transitions;
}

export function intersectSyncedPaths(sourcePaths: string[], targetPaths: string[]): string[] {
  const targetSet = new Set(targetPaths);
  return sortedUnique(sourcePaths.filter((entry) => targetSet.has(entry)));
}
