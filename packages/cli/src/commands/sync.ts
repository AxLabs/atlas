import { CliError, CliErrorCode } from "../errors/cli-error";
import { findAtlasRepoRoot } from "../project/find-root";
import { compareAppInfrastructureManifest } from "../template-sync/compare";
import { loadAppInfrastructureManifest } from "../template-sync/manifest";
import { applyTemplateSyncActions, planTemplateSyncActions } from "../template-sync/sync";

import type { PlannedAction } from "../types/result";

export interface SyncInfrastructureOptions {
  cwd?: string;
  dryRun?: boolean;
  check?: boolean;
}

export interface SyncInfrastructureResult {
  ok: boolean;
  drifts: number;
  structuralIssues: number;
  actions: PlannedAction[];
}

export function runSyncInfrastructureCommand(
  options: SyncInfrastructureOptions = {}
): SyncInfrastructureResult {
  const repoRoot = findAtlasRepoRoot(options.cwd ?? process.cwd());
  if (!repoRoot) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      "Unable to locate Atlas repository root. Run from an Atlas checkout."
    );
  }

  const manifest = loadAppInfrastructureManifest(repoRoot);
  const comparison = compareAppInfrastructureManifest(repoRoot, manifest);
  const plannedSyncActions = planTemplateSyncActions(repoRoot, manifest, comparison.drifts);

  const actions: PlannedAction[] = plannedSyncActions.map((action) => ({
    kind: options.check || options.dryRun ? "skip" : "copy",
    path: `${action.toApplication}/${action.relativePath}`,
    reason: action.reason,
  }));

  const ok = comparison.drifts.length === 0 && comparison.structuralIssues.length === 0;

  if (!options.check && !options.dryRun && plannedSyncActions.length > 0) {
    applyTemplateSyncActions(repoRoot, plannedSyncActions, false);
  }

  return {
    ok,
    actions,
    drifts: comparison.drifts.length,
    structuralIssues: comparison.structuralIssues.length,
  };
}

export function formatSyncInfrastructureResult(
  result: SyncInfrastructureResult,
  dryRun: boolean
): string[] {
  const lines = [
    "Atlas infrastructure sync",
    `Drifted synced paths: ${result.drifts}`,
    `Structural issues: ${result.structuralIssues}`,
  ];

  if (result.actions.length === 0) {
    lines.push("No template synchronization actions required.");
    return lines;
  }

  const modeLabel = dryRun ? "Would update" : "Updated";
  lines.push(`${modeLabel} ${result.actions.length} path(s):`);
  for (const action of result.actions) {
    lines.push(`  - ${action.path}`);
  }

  if (dryRun) {
    lines.push("Run without --dry-run to apply copies from the canonical starter.");
  }

  return lines;
}

export function writeSyncHelp(
  writer: { writeStdout: (line: string) => void },
  json: boolean
): void {
  if (json) {
    writer.writeStdout(
      JSON.stringify({
        command: "sync infrastructure",
        description:
          "Synchronize duplicated Atlas template infrastructure from the canonical starter into consumer applications.",
        options: ["--check", "--dry-run", "--json", "--cwd"],
      })
    );
    return;
  }

  writer.writeStdout(
    "Usage: atlas sync infrastructure [--check] [--dry-run] [--json] [--cwd <path>]"
  );
  writer.writeStdout("");
  writer.writeStdout(
    "Copy canonical starter template infrastructure into consumer applications per templates/app-infrastructure.manifest.json."
  );
  writer.writeStdout("");
  writer.writeStdout("  --check    Report drift without copying files");
  writer.writeStdout("  --dry-run  Show planned copies without writing files");
}
