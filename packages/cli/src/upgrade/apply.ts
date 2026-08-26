import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { UpgradePlan, UpgradePlanItem } from "./types";

export interface ApplySafeUpgradeOptions {
  applicationRoot: string;
  plan: UpgradePlan;
  targetSnapshot: Record<string, string>;
  dryRun?: boolean;
}

export interface ApplySafeUpgradeResult {
  applied: UpgradePlanItem[];
  skipped: UpgradePlanItem[];
}

function shouldApplyItem(item: UpgradePlanItem): boolean {
  if (item.conflict || item.category === "merge-required") {
    return false;
  }

  return item.action === "replace" || item.action === "create" || item.action === "remove";
}

/** Internal/test helper: apply only patch-safe template replacements with no conflicts. */
export function applySafeUpgradeReplacements(
  options: ApplySafeUpgradeOptions
): ApplySafeUpgradeResult {
  const applied: UpgradePlanItem[] = [];
  const skipped: UpgradePlanItem[] = [];

  for (const item of options.plan.items) {
    if (!shouldApplyItem(item)) {
      skipped.push(item);
      continue;
    }

    const absolutePath = path.join(options.applicationRoot, item.relativePath);

    if (item.action === "remove") {
      if (!options.dryRun) {
        try {
          unlinkSync(absolutePath);
        } catch {
          skipped.push(item);
          continue;
        }
      }
      applied.push(item);
      continue;
    }

    const targetContent = options.targetSnapshot[item.relativePath];
    if (targetContent === undefined) {
      skipped.push(item);
      continue;
    }

    if (!options.dryRun) {
      mkdirSync(path.dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, targetContent, "utf8");
    }

    applied.push(item);
  }

  return { applied, skipped };
}
