import { CliError, CliErrorCode } from "../errors/cli-error";
import { writeCommandSuccess } from "../output/write";
import { resolveRepoRootFromOptions } from "../project/find-root";
import { runUpgrade } from "../upgrade/run";

import type { OutputWriter } from "../output/write";
import type { UpgradeRunResult } from "../upgrade/types";

export interface UpgradeCommandOptions {
  cwd?: string;
  targetVersion?: string;
  dryRun?: boolean;
  allowDirty?: boolean;
  json?: boolean;
  releasesDir?: string;
  skipValidation?: boolean;
  writer: OutputWriter;
}

export function formatUpgradeHumanResult(result: UpgradeRunResult): string[] {
  const lines = [
    `Current baseline: ${result.sourceVersion}`,
    `Target: ${result.targetVersion}`,
    `Mode: ${result.mode}`,
    `Status: ${result.status}`,
    "",
    `Safe replacements: ${result.summary.replacements}`,
    `Package updates: ${result.summary.packageUpdates}`,
    `Generated surfaces: ${result.summary.regenerations}`,
    `Migrations: ${result.migrations.length}`,
    `Conflicts: ${result.conflicts.length}`,
    `Manual reviews: ${result.summary.manual}`,
  ];

  if (result.messages.length > 0) {
    lines.push("");
    for (const message of result.messages) {
      lines.push(message);
    }
  }

  if (result.items.length > 0) {
    lines.push("");
    lines.push("Plan items:");
    for (const item of result.items) {
      const flags = [item.action, item.category, item.conflict ? "conflict" : "ok"].join(" | ");
      lines.push(`  - ${item.relativePath}: ${flags}`);
    }
  }

  if (result.conflicts.length > 0) {
    lines.push("");
    lines.push("Blocking conflicts:");
    for (const conflict of result.conflicts) {
      lines.push(`  - ${conflict.relativePath}: ${conflict.message}`);
    }
  }

  if (result.appliedPaths.length > 0) {
    lines.push("");
    lines.push(`Applied paths (${result.appliedPaths.length}):`);
    for (const appliedPath of result.appliedPaths) {
      lines.push(`  - ${appliedPath}`);
    }
  }

  lines.push("");
  lines.push(`Baseline updated: ${result.baselineUpdated ? "yes" : "no"}`);

  return lines;
}

export function upgradeExitCodeFromResult(result: UpgradeRunResult): number {
  switch (result.status) {
    case "success":
    case "already-current":
    case "planned":
      return 0;
    case "blocked":
      return 9;
    case "validation-failed":
      return 8;
    case "failed":
      return 1;
    default:
      return 1;
  }
}

export function writeUpgradeHelp(writer: OutputWriter, json: boolean): void {
  const lines = [
    "Atlas upgrade — plan and apply supported Atlas release upgrades",
    "",
    "Upgrades respect ownership channels and platform.baseline checksum evidence.",
    "Consumer-owned and modified synced paths are never overwritten automatically.",
    "",
    "Usage:",
    "  atlas upgrade --to <version> [options]",
    "",
    "Options:",
    "  --to <version>       Target Atlas release version (required)",
    "  --dry-run            Plan without filesystem mutations",
    "  --json               Emit machine-readable JSON on stdout",
    "  --allow-dirty        Allow mutations on a dirty Git worktree (use with caution)",
    "  --cwd <path>         Resolve the Atlas repository from a starting directory",
    "",
    "Exit behavior:",
    "  0 — successful dry-run or completed upgrade",
    "  9 — blocking conflicts in plan",
    "  10 — missing baseline, release snapshot, or migration chain",
    "  8 — post-upgrade validation failed",
    "",
    "See docs/how-we-build/upgrades.md for ownership and conflict policy.",
  ];

  if (json) {
    writer.writeStdout(
      JSON.stringify({
        ok: true,
        command: "upgrade-help",
        result: { lines },
      })
    );
    return;
  }

  for (const line of lines) {
    writer.writeStdout(line);
  }
}

export async function runUpgradeCommand(options: UpgradeCommandOptions): Promise<number> {
  if (!options.targetVersion) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      "Missing required --to <version> target for atlas upgrade."
    );
  }

  const repoRoot = resolveRepoRootFromOptions({ cwd: options.cwd });

  const result = await runUpgrade({
    repoRoot,
    targetVersion: options.targetVersion,
    dryRun: options.dryRun,
    allowDirty: options.allowDirty,
    releasesDir: options.releasesDir,
    skipValidation: options.skipValidation,
  });

  writeCommandSuccess(
    options.writer,
    "upgrade",
    result,
    options.json ?? false,
    formatUpgradeHumanResult
  );

  return upgradeExitCodeFromResult(result);
}
