import { readFileSync } from "node:fs";
import path from "node:path";

import type { ReleaseSnapshotManifest } from "./release-snapshot";
import type { UpgradePlanItem } from "./types";

const ATLAS_WORKSPACE_PACKAGES = [
  "@atlas/cli",
  "@atlas/config",
  "@atlas/consent",
  "@atlas/project",
  "@atlas/ui",
] as const;

export function readWorkspacePackageVersion(repoRoot: string, packageName: string): string | null {
  const packageJsonPath = path.join(
    repoRoot,
    "packages",
    packageName.replace("@atlas/", ""),
    "package.json"
  );

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: unknown };
    return typeof parsed.version === "string" ? parsed.version : null;
  } catch {
    return null;
  }
}

export function planPackageUpdates(options: {
  repoRoot: string;
  sourceManifest: ReleaseSnapshotManifest;
  targetManifest: ReleaseSnapshotManifest;
}): UpgradePlanItem[] {
  const items: UpgradePlanItem[] = [];

  for (const packageName of ATLAS_WORKSPACE_PACKAGES) {
    const sourceVersion = options.sourceManifest.packageVersions[packageName];
    const targetVersion = options.targetManifest.packageVersions[packageName];
    const currentVersion = readWorkspacePackageVersion(options.repoRoot, packageName);

    if (!targetVersion) {
      continue;
    }

    if (sourceVersion === targetVersion) {
      items.push({
        relativePath: packageName,
        ownershipChannel: "versioned-package",
        category: "patch-safe",
        action: "skip",
        message: `${packageName} remains at ${targetVersion} between source and target Atlas releases.`,
        conflict: false,
        securityCritical: false,
        sourceVersion: sourceVersion ?? currentVersion ?? undefined,
        targetVersion,
      });
      continue;
    }

    items.push({
      relativePath: packageName,
      ownershipChannel: "versioned-package",
      category: "patch-safe",
      action: "package-upgrade",
      message: `${packageName} ${sourceVersion ?? currentVersion ?? "unknown"} → ${targetVersion}. Workspace monorepos typically align package versions with the Atlas release; review changelogs for breaking API changes.`,
      conflict: false,
      securityCritical: false,
      sourceVersion: sourceVersion ?? currentVersion ?? undefined,
      targetVersion,
    });
  }

  return items.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}
