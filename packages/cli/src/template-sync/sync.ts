import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

import type { TemplateSyncDrift } from "./compare";
import type { AppInfrastructureManifest } from "./manifest";

export interface TemplateSyncAction {
  kind: "copy";
  fromApplication: string;
  toApplication: string;
  relativePath: string;
  reason: string;
}

export function planTemplateSyncActions(
  _repoRoot: string,
  manifest: AppInfrastructureManifest,
  drifts: TemplateSyncDrift[]
): TemplateSyncAction[] {
  const actions: TemplateSyncAction[] = [];

  for (const drift of drifts) {
    if (drift.kind === "content-drift" || drift.kind === "missing-in-consumer") {
      actions.push({
        kind: "copy",
        fromApplication: manifest.canonicalApplication,
        toApplication: drift.consumerApplication,
        relativePath: drift.relativePath,
        reason: drift.message,
      });
    }
  }

  return actions.sort((left, right) =>
    `${left.toApplication}/${left.relativePath}`.localeCompare(
      `${right.toApplication}/${right.relativePath}`
    )
  );
}

export function applyTemplateSyncActions(
  repoRoot: string,
  actions: TemplateSyncAction[],
  dryRun: boolean
): TemplateSyncAction[] {
  const applied: TemplateSyncAction[] = [];

  for (const action of actions) {
    const sourcePath = path.join(repoRoot, action.fromApplication, action.relativePath);
    const targetPath = path.join(repoRoot, action.toApplication, action.relativePath);

    if (!existsSync(sourcePath)) {
      continue;
    }

    if (!dryRun) {
      mkdirSync(path.dirname(targetPath), { recursive: true });
      copyFileSync(sourcePath, targetPath);
    }

    applied.push(action);
  }

  return applied;
}
