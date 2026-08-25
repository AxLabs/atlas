import { computeBaselineChecksum } from "@atlas/project";

import type { PlanUpgradeOptions, UpgradePlan, UpgradePlanItem, UpgradePlanSummary } from "./types";

function summarizePlan(items: UpgradePlanItem[]): UpgradePlanSummary {
  const summary: UpgradePlanSummary = {
    patchSafe: 0,
    mergeRequired: 0,
    migrationRequired: 0,
    manual: 0,
    securityCritical: 0,
    skipped: 0,
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
  }

  return summary;
}

function consumerModifiedSyncedPath(
  relativePath: string,
  baselineChecksums: Record<string, string>,
  consumerFiles: Record<string, string>
): boolean {
  const baselineChecksum = baselineChecksums[relativePath];
  if (!baselineChecksum) {
    return false;
  }

  const consumerContent = consumerFiles[relativePath];
  if (consumerContent === undefined) {
    return true;
  }

  return computeBaselineChecksum(consumerContent) !== baselineChecksum;
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
    const consumerModified = consumerModifiedSyncedPath(
      relativePath,
      options.baselineChecksums,
      options.consumerFiles
    );

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

    if (consumerModified) {
      items.push({
        relativePath,
        ownershipChannel: "atlas-managed-template",
        category: "merge-required",
        action: "manual-review",
        message: `Consumer modified ${relativePath} after Atlas ${options.baselineAtlasVersion}. Atlas ${options.targetAtlasVersion} also changed this file; manual merge is required.`,
        conflict: true,
      });
      continue;
    }

    const isSecurityPath =
      relativePath.includes("src/lib/security/") ||
      relativePath.includes("src/lib/auth/session.ts");

    items.push({
      relativePath,
      ownershipChannel: "atlas-managed-template",
      category: isSecurityPath ? "security-critical" : "patch-safe",
      action: "replace",
      message: isSecurityPath
        ? `Security-relevant synced path ${relativePath} can be replaced because the consumer copy still matches the recorded Atlas baseline.`
        : `Synced path ${relativePath} can be replaced from Atlas ${options.targetAtlasVersion}.`,
      conflict: false,
    });
  }

  for (const relativePath of [...options.independentPaths].sort((left, right) =>
    left.localeCompare(right)
  )) {
    const targetIndependentContent = options.targetSnapshot.syncedPaths[relativePath];
    const sourceIndependentContent = options.sourceSnapshot.syncedPaths[relativePath];

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
      ownershipChannel: "generated-artifact",
      category: "patch-safe",
      action: "regenerate",
      message:
        "OpenAPI spec changed between Atlas versions. Regenerate machine-owned client artifacts after merging the spec.",
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
