import {
  type BaselineIntegrityIssue,
  type PlatformBaseline,
  validatePlatformBaselineIntegrity,
} from "@atlas/project";

export function validateUpgradeSourceBaseline(options: {
  baseline: PlatformBaseline;
  sourceSyncedPaths: string[];
  targetSyncedPaths: string[];
  currentManifestSchemaVersion: number;
}): BaselineIntegrityIssue[] {
  const issues = validatePlatformBaselineIntegrity({
    baseline: options.baseline,
    expectedSyncedPaths: options.sourceSyncedPaths,
    currentManifestSchemaVersion: options.currentManifestSchemaVersion,
  });

  const removedSyncedPaths = new Set(
    options.sourceSyncedPaths.filter((entry) => !options.targetSyncedPaths.includes(entry))
  );

  return issues.filter((issue) => {
    if (issue.kind !== "stale-baseline-entry" || !issue.relativePath) {
      return true;
    }

    return !removedSyncedPaths.has(issue.relativePath);
  });
}
