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
  initialDrifts: number;
  initialStructuralIssues: number;
  plannedActions: number;
  appliedActions: number;
  remainingDrifts: number;
  remainingStructuralIssues: number;
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
  const initialComparison = compareAppInfrastructureManifest(repoRoot, manifest);
  const plannedSyncActions = planTemplateSyncActions(repoRoot, manifest, initialComparison.drifts);

  const actions: PlannedAction[] = plannedSyncActions.map((action) => ({
    kind: options.check || options.dryRun ? "skip" : "copy",
    path: `${action.toApplication}/${action.relativePath}`,
    reason: action.reason,
  }));

  let appliedActions = 0;

  if (!options.check && !options.dryRun && plannedSyncActions.length > 0) {
    const applied = applyTemplateSyncActions(repoRoot, plannedSyncActions, false);
    appliedActions = applied.length;
  }

  const finalComparison =
    options.check || options.dryRun
      ? initialComparison
      : compareAppInfrastructureManifest(repoRoot, manifest);

  const ok = finalComparison.drifts.length === 0 && finalComparison.structuralIssues.length === 0;

  return {
    ok,
    initialDrifts: initialComparison.drifts.length,
    initialStructuralIssues: initialComparison.structuralIssues.length,
    plannedActions: plannedSyncActions.length,
    appliedActions,
    remainingDrifts: finalComparison.drifts.length,
    remainingStructuralIssues: finalComparison.structuralIssues.length,
    actions,
  };
}

export function formatSyncInfrastructureResult(
  result: SyncInfrastructureResult,
  dryRun: boolean
): string[] {
  const lines = [
    "Atlas infrastructure sync",
    `Initial drifted synced paths: ${result.initialDrifts}`,
    `Initial structural issues: ${result.initialStructuralIssues}`,
    `Planned actions: ${result.plannedActions}`,
  ];

  if (result.appliedActions > 0) {
    lines.push(`Applied actions: ${result.appliedActions}`);
  }

  lines.push(
    `Remaining drifted synced paths: ${result.remainingDrifts}`,
    `Remaining structural issues: ${result.remainingStructuralIssues}`,
    `Final health: ${result.ok ? "healthy" : "unhealthy"}`
  );

  if (result.actions.length === 0) {
    lines.push("No template synchronization actions required.");
    return lines;
  }

  const modeLabel = dryRun ? "Would update" : result.appliedActions > 0 ? "Updated" : "Planned";
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
