import { mkdirSync, writeFileSync } from "node:fs";
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

/** Internal/test helper: apply only patch-safe template replacements with no conflicts. */
export function applySafeUpgradeReplacements(
  options: ApplySafeUpgradeOptions
): ApplySafeUpgradeResult {
  const applied: UpgradePlanItem[] = [];
  const skipped: UpgradePlanItem[] = [];

  for (const item of options.plan.items) {
    if (item.action !== "replace" || item.conflict || item.category === "merge-required") {
      skipped.push(item);
      continue;
    }

    const targetContent = options.targetSnapshot[item.relativePath];
    if (targetContent === undefined) {
      skipped.push(item);
      continue;
    }

    const absolutePath = path.join(options.applicationRoot, item.relativePath);
    if (!options.dryRun) {
      mkdirSync(path.dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, targetContent, "utf8");
    }

    applied.push(item);
  }

  return { applied, skipped };
}
