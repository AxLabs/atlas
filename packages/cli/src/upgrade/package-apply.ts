import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { UpgradePlanItem } from "./types";

const ATLAS_PACKAGE_DIR: Record<string, string> = {
  "@atlas/cli": "packages/cli/package.json",
  "@atlas/config": "packages/config/package.json",
  "@atlas/consent": "packages/consent/package.json",
  "@atlas/project": "packages/project/package.json",
  "@atlas/ui": "packages/ui/package.json",
};

export interface ApplyPackageUpdatesResult {
  applied: string[];
  skipped: UpgradePlanItem[];
  blocked: UpgradePlanItem[];
}

function readPackageVersion(absolutePath: string): string | null {
  try {
    const parsed = JSON.parse(readFileSync(absolutePath, "utf8")) as { version?: unknown };
    return typeof parsed.version === "string" ? parsed.version : null;
  } catch {
    return null;
  }
}

function writePackageVersion(absolutePath: string, version: string): void {
  const parsed = JSON.parse(readFileSync(absolutePath, "utf8")) as Record<string, unknown>;
  parsed.version = version;
  writeFileSync(absolutePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
}

export function applyPackageUpdates(options: {
  repoRoot: string;
  items: UpgradePlanItem[];
  dryRun?: boolean;
}): ApplyPackageUpdatesResult {
  const applied: string[] = [];
  const skipped: UpgradePlanItem[] = [];
  const blocked: UpgradePlanItem[] = [];

  for (const item of options.items) {
    if (item.action !== "package-upgrade") {
      continue;
    }

    if (item.conflict) {
      blocked.push(item);
      continue;
    }

    const relativePackagePath = ATLAS_PACKAGE_DIR[item.relativePath];
    if (!relativePackagePath) {
      skipped.push(item);
      continue;
    }

    const absolutePath = path.join(options.repoRoot, relativePackagePath);
    const currentVersion = readPackageVersion(absolutePath);
    if (currentVersion === null) {
      skipped.push(item);
      continue;
    }

    if (!item.targetVersion || currentVersion === item.targetVersion) {
      skipped.push(item);
      continue;
    }

    if (item.sourceVersion && currentVersion !== item.sourceVersion) {
      blocked.push({
        ...item,
        conflict: true,
        category: "manual",
        action: "manual-review",
        message: `${item.relativePath} version ${currentVersion} differs from the source Atlas release (${item.sourceVersion}). Manual review is required before Atlas can align package identity.`,
      });
      continue;
    }

    if (!options.dryRun) {
      writePackageVersion(absolutePath, item.targetVersion);
    }

    applied.push(relativePackagePath);
  }

  return { applied, skipped, blocked };
}

export function hasUnresolvedRequiredPackageWork(items: UpgradePlanItem[]): boolean {
  return items.some(
    (item) =>
      (item.action === "package-upgrade" && item.conflict) ||
      (item.ownershipChannel === "versioned-package" &&
        item.action === "manual-review" &&
        item.conflict)
  );
}
