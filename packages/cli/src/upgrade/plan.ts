import { getSyncedPathBaselineStatus } from "@atlas/project";

import type { PlanUpgradeOptions, UpgradePlan, UpgradePlanItem, UpgradePlanSummary } from "./types";

/**
 * Test-only security relevance heuristic for upgrade rehearsal evidence (#17).
 * Canonical security-critical classification belongs to #14 advisory metadata — not this planner.
 */
function isSecurityRelevantSyncedPath(relativePath: string): boolean {
  return (
    relativePath.includes("src/lib/security/") || relativePath.includes("src/lib/auth/session.ts")
  );
}

function summarizePlan(items: UpgradePlanItem[]): UpgradePlanSummary {
  const summary: UpgradePlanSummary = {
    patchSafe: 0,
    mergeRequired: 0,
    migrationRequired: 0,
    manual: 0,
    securityCritical: 0,
    skipped: 0,
    packageUpdates: 0,
    regenerations: 0,
    replacements: 0,
  };

  for (const item of items) {
    switch (item.category) {
      case "patch-safe":
        summary.patchSafe += 1;
        break;
      case "merge-required":
        summary.mergeRequired += 1;
        break;
      case "migration-required":
        summary.migrationRequired += 1;
        break;
      case "manual":
        summary.manual += 1;
        break;
      case "security-critical":
        summary.securityCritical += 1;
        break;
      default:
        break;
    }

    if (item.action === "skip") {
      summary.skipped += 1;
    }

    if (item.action === "package-upgrade") {
      summary.packageUpdates += 1;
    }

    if (item.action === "regenerate") {
      summary.regenerations += 1;
    }

    if (item.action === "replace") {
      summary.replacements += 1;
    }
  }

  return summary;
}

export function planUpgrade(options: PlanUpgradeOptions): UpgradePlan {
  const items: UpgradePlanItem[] = [];

  if (options.contractSchemaChanged) {
    items.push({
      relativePath: "atlas.config.json",
      ownershipChannel: "structural-contract",
      category: "migration-required",
      action: "migration",
      message:
        "Atlas contract schema changed between baseline and target. Run the documented contract migration before applying template updates.",
      conflict: false,
    });
  }

  for (const relativePath of [...options.syncedPaths].sort((left, right) =>
    left.localeCompare(right)
  )) {
    const sourceContent = options.sourceSnapshot.syncedPaths[relativePath];
    const targetContent = options.targetSnapshot.syncedPaths[relativePath];
    const consumerContent = options.consumerFiles[relativePath];
    const baselineStatus = getSyncedPathBaselineStatus({
      relativePath,
      consumerApplicationRoot: options.applicationRoot,
      baselineChecksums: options.baselineChecksums,
      consumerContent,
    });

    if (sourceContent === undefined || targetContent === undefined) {
      items.push({
        relativePath,
        ownershipChannel: "atlas-managed-template",
        category: "manual",
        action: "manual-review",
        message: `Missing source or target snapshot for synced path ${relativePath}.`,
        conflict: true,
      });
      continue;
    }

    if (sourceContent === targetContent) {
      items.push({
        relativePath,
        ownershipChannel: "atlas-managed-template",
        category: "patch-safe",
        action: "skip",
        message: `Synced path ${relativePath} is unchanged in Atlas ${options.targetAtlasVersion}.`,
        conflict: false,
      });
      continue;
    }

    if (consumerContent === undefined) {
      items.push({
        relativePath,
        ownershipChannel: "atlas-managed-template",
        category: "manual",
        action: "manual-review",
        message: `Consumer file ${relativePath} is missing while Atlas ${options.targetAtlasVersion} changed this synced path. Restore or recreate the file before upgrading.`,
        conflict: true,
      });
      continue;
    }

    if (baselineStatus === "unknown") {
      items.push({
        relativePath,
        ownershipChannel: "atlas-managed-template",
        category: "manual",
        action: "manual-review",
        message: `Insufficient baseline evidence for ${relativePath}. Atlas ${options.targetAtlasVersion} changed this synced path, but the recorded baseline does not prove the consumer copy is unchanged. Manual review is required before replacement.`,
        conflict: true,
        baselineStatus,
      });
      continue;
    }

    if (baselineStatus === "modified") {
      const isSecurityPath = isSecurityRelevantSyncedPath(relativePath);
      items.push({
        relativePath,
        ownershipChannel: "atlas-managed-template",
        category: isSecurityPath ? "security-critical" : "merge-required",
        action: "manual-review",
        message: isSecurityPath
          ? `Consumer modified security-relevant synced path ${relativePath} after Atlas ${options.baselineAtlasVersion}. Atlas ${options.targetAtlasVersion} also changed this file; elevated manual remediation is required and automatic overwrite is forbidden.`
          : `Consumer modified ${relativePath} after Atlas ${options.baselineAtlasVersion}. Atlas ${options.targetAtlasVersion} also changed this file; manual merge is required.`,
        conflict: true,
        securityCritical: isSecurityPath,
        baselineStatus,
      });
      continue;
    }

    const isSecurityPath = isSecurityRelevantSyncedPath(relativePath);

    items.push({
      relativePath,
      ownershipChannel: "atlas-managed-template",
      category: isSecurityPath ? "security-critical" : "patch-safe",
      action: "replace",
      message: isSecurityPath
        ? `Security-relevant synced path ${relativePath} can be replaced because the consumer copy still matches the recorded Atlas baseline.`
        : `Synced path ${relativePath} can be replaced from Atlas ${options.targetAtlasVersion}.`,
      conflict: false,
      securityCritical: isSecurityPath,
      baselineStatus,
    });
  }

  for (const relativePath of [...options.independentPaths].sort((left, right) =>
    left.localeCompare(right)
  )) {
    const targetIndependentContent = options.targetSnapshot.syncedPaths[relativePath];
    const sourceIndependentContent = options.sourceSnapshot.syncedPaths[relativePath];

    if (targetIndependentContent !== undefined && sourceIndependentContent === undefined) {
      items.push({
        relativePath,
        ownershipChannel: "consumer-owned-source",
        category: "manual",
        action: "manual-review",
        message: `Application-owned path ${relativePath} was introduced in Atlas ${options.targetAtlasVersion}. Review whether the consumer should adopt the new wiring pattern.`,
        conflict: false,
      });
      continue;
    }

    if (
      sourceIndependentContent !== undefined &&
      targetIndependentContent !== undefined &&
      sourceIndependentContent !== targetIndependentContent
    ) {
      items.push({
        relativePath,
        ownershipChannel: "consumer-owned-source",
        category: "manual",
        action: "manual-review",
        message: `Application-owned path ${relativePath} changed in Atlas ${options.targetAtlasVersion}. Review whether the consumer should adopt the new wiring pattern.`,
        conflict: false,
      });
    } else {
      items.push({
        relativePath,
        ownershipChannel: "consumer-owned-source",
        category: "patch-safe",
        action: "skip",
        message: `Application-owned path ${relativePath} is never overwritten automatically.`,
        conflict: false,
      });
    }
  }

  for (const relativePath of [...options.generatedPaths].sort((left, right) =>
    left.localeCompare(right)
  )) {
    const sourceGenerated = options.sourceSnapshot.generatedPaths?.[relativePath];
    const targetGenerated = options.targetSnapshot.generatedPaths?.[relativePath];

    if (sourceGenerated === targetGenerated) {
      items.push({
        relativePath,
        ownershipChannel: "generated-artifact",
        category: "patch-safe",
        action: "skip",
        message: `Generated path ${relativePath} is unchanged between Atlas versions.`,
        conflict: false,
      });
      continue;
    }

    items.push({
      relativePath,
      ownershipChannel: "generated-artifact",
      category: "patch-safe",
      action: "regenerate",
      message: `Regenerate ${relativePath} from the updated OpenAPI spec instead of copying template source.`,
      conflict: false,
    });
  }

  if (
    options.sourceSnapshot.openApiSpec !== undefined &&
    options.targetSnapshot.openApiSpec !== undefined &&
    options.sourceSnapshot.openApiSpec !== options.targetSnapshot.openApiSpec
  ) {
    items.push({
      relativePath: "openapi/openapi.json",
      ownershipChannel: "consumer-owned-source",
      category: "manual",
      action: "manual-review",
      message:
        "OpenAPI spec changed in the target Atlas release. The consumer-owned spec is never overwritten automatically. Review Atlas changes, merge the spec manually, then run api:gen to regenerate client artifacts.",
      conflict: false,
    });
  }

  const sortedItems = items.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath)
  );
  const summary = summarizePlan(sortedItems);

  return {
    sourceAtlasVersion: options.baselineAtlasVersion,
    targetAtlasVersion: options.targetAtlasVersion,
    applicationRoot: options.applicationRoot,
    items: sortedItems,
    summary,
    hasBlockingConflicts: sortedItems.some((item) => item.conflict),
    hasIncompleteMigrations: sortedItems.some((item) => item.action === "migration"),
  };
}

export function serializeUpgradePlan(plan: UpgradePlan): string {
  return `${JSON.stringify(plan, null, 2)}\n`;
}
