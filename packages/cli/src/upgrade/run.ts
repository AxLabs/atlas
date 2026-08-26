import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  ATLAS_CONTRACT_FILENAME,
  joinRepoPath,
  type PlatformBaseline,
  type RawAtlasProjectContract,
  readAtlasProjectContractFile,
  validatePlatformBaselineIntegrity,
} from "@atlas/project";

import { doctorExitCodeIndicatesFailure, runDoctor } from "../doctor";
import { CliError, CliErrorCode } from "../errors/cli-error";
import { SUPPORTED_APP_INFRASTRUCTURE_MANIFEST_SCHEMA_VERSION } from "../template-sync/manifest";

import {
  type AtlasMigrationDefinition,
  resolveMigrationChain,
  runMigrationChain,
} from "./migrations/registry";
import { applySafeUpgradeReplacements } from "./apply";
import {
  captureConsumerPlatformBaseline,
  mergePlatformBaselineIntoContract,
  readContractPlatformBaseline,
} from "./baseline";
import { planPackageUpdates } from "./package-plan";
import { planUpgrade } from "./plan";
import {
  buildManifestSubsetFromRelease,
  type LoadedReleaseSnapshot,
  loadReleaseSnapshot,
} from "./release-snapshot";
import { compareAtlasVersions } from "./version-compare";
import { assertCleanWorktreeForMutation } from "./worktree";

import type {
  UpgradeMigrationReport,
  UpgradePlanItem,
  UpgradePlanSummary,
  UpgradeRunResult,
  UpgradeRunStatus,
  UpgradeValidationReport,
} from "./types";

export interface RunUpgradeOptions {
  repoRoot: string;
  targetVersion: string;
  dryRun?: boolean;
  allowDirty?: boolean;
  releasesDir?: string;
  skipValidation?: boolean;
}

function readConsumerFile(
  applicationAbsoluteRoot: string,
  relativePath: string
): string | undefined {
  const absolutePath = path.join(applicationAbsoluteRoot, relativePath);
  if (!existsSync(absolutePath)) {
    return undefined;
  }

  return readFileSync(absolutePath, "utf8");
}

function loadConsumerFiles(
  applicationAbsoluteRoot: string,
  relativePaths: string[]
): Record<string, string> {
  const files: Record<string, string> = {};

  for (const relativePath of relativePaths) {
    const content = readConsumerFile(applicationAbsoluteRoot, relativePath);
    if (content !== undefined) {
      files[relativePath] = content;
    }
  }

  return files;
}

function mergePlanItems(
  baseItems: UpgradePlanItem[],
  extraItems: UpgradePlanItem[]
): UpgradePlanItem[] {
  return [...baseItems, ...extraItems].sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath)
  );
}

function summarizeMergedItems(items: UpgradePlanItem[]): UpgradePlanSummary {
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

function buildMigrationReports(
  migrations: AtlasMigrationDefinition[],
  mode: "dry-run" | "apply",
  applied: UpgradeMigrationReport[]
): UpgradeMigrationReport[] {
  if (applied.length > 0) {
    return applied;
  }

  return migrations.map((migration) => ({
    id: migration.id,
    sourceVersion: migration.sourceVersion,
    targetVersion: migration.targetVersion,
    description: migration.description,
    automatic: migration.automatic,
    status: mode === "dry-run" ? "planned" : "skipped",
    changedPaths: [],
    message:
      mode === "dry-run"
        ? `Migration ${migration.id} is planned between Atlas ${migration.sourceVersion} and ${migration.targetVersion}.`
        : `Migration ${migration.id} was not executed.`,
  }));
}

function runApiGen(repoRoot: string): { ok: boolean; message: string } {
  const result = spawnSync("pnpm", ["api:gen"], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (result.status === 0) {
    return { ok: true, message: "pnpm api:gen completed successfully." };
  }

  const stderr = result.stderr?.trim() || result.stdout?.trim() || "pnpm api:gen failed.";
  return { ok: false, message: stderr };
}

function writePlatformBaseline(
  repoRoot: string,
  contract: RawAtlasProjectContract,
  baseline: PlatformBaseline
): void {
  const updatedContract = mergePlatformBaselineIntoContract(contract, baseline);
  const contractPath = joinRepoPath(repoRoot, ATLAS_CONTRACT_FILENAME);
  writeFileSync(contractPath, `${JSON.stringify(updatedContract, null, 2)}\n`, "utf8");
}

export async function runUpgrade(options: RunUpgradeOptions): Promise<UpgradeRunResult> {
  const mode = options.dryRun ? "dry-run" : "apply";
  const contract = readAtlasProjectContractFile(options.repoRoot);
  const baseline = readContractPlatformBaseline(contract);

  if (!baseline) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      "platform.baseline is missing from atlas.config.json. Record a baseline via atlas init before upgrading."
    );
  }

  const sourceVersion = baseline.atlasVersion;
  const targetVersion = options.targetVersion;

  if (compareAtlasVersions(sourceVersion, targetVersion) === 0) {
    return {
      sourceVersion,
      targetVersion,
      mode,
      status: "already-current",
      summary: summarizeMergedItems([]),
      items: [],
      conflicts: [],
      migrations: [],
      validation: { doctor: "skipped", apiGen: "skipped" },
      baselineUpdated: false,
      appliedPaths: [],
      messages: [`Consumer baseline is already Atlas ${sourceVersion}. No upgrade required.`],
    };
  }

  if (compareAtlasVersions(sourceVersion, targetVersion) > 0) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `Downgrade from Atlas ${sourceVersion} to ${targetVersion} is not supported.`
    );
  }

  const sourceRelease = loadReleaseSnapshot({
    repoRoot: options.repoRoot,
    atlasVersion: sourceVersion,
    releasesDir: options.releasesDir,
  });
  const targetRelease = loadReleaseSnapshot({
    repoRoot: options.repoRoot,
    atlasVersion: targetVersion,
    releasesDir: options.releasesDir,
  });

  const migrationChain = resolveMigrationChain(sourceVersion, targetVersion);
  if (migrationChain.missingTarget) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `Missing migration chain from Atlas ${sourceVersion} to ${targetVersion}. No registered migration starts from the current chain position.`,
      {
        details: migrationChain.migrations.map(
          (migration) => `${migration.sourceVersion} → ${migration.targetVersion} (${migration.id})`
        ),
      }
    );
  }

  const manifestSubset = buildManifestSubsetFromRelease(targetRelease.manifest);
  const baselineIntegrityIssues = validatePlatformBaselineIntegrity({
    baseline,
    expectedSyncedPaths: manifestSubset.syncedPaths,
    currentManifestSchemaVersion: SUPPORTED_APP_INFRASTRUCTURE_MANIFEST_SCHEMA_VERSION,
  });

  if (baselineIntegrityIssues.length > 0) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      "platform.baseline is incomplete or inconsistent with the current infrastructure manifest.",
      {
        details: baselineIntegrityIssues.map((issue) => issue.message),
      }
    );
  }

  const applicationRoot = targetRelease.manifest.canonicalApplication;
  const applicationAbsoluteRoot = joinRepoPath(options.repoRoot, applicationRoot);
  const allRelativePaths = [
    ...manifestSubset.syncedPaths,
    ...manifestSubset.generatedPaths,
    ...targetRelease.manifest.independentPaths,
  ];
  const consumerFiles = loadConsumerFiles(applicationAbsoluteRoot, allRelativePaths);

  const contractSchemaChanged =
    sourceRelease.manifest.contractSchemaVersion !== targetRelease.manifest.contractSchemaVersion;

  const templatePlan = planUpgrade({
    applicationRoot,
    baselineAtlasVersion: sourceVersion,
    targetAtlasVersion: targetVersion,
    baselineChecksums: baseline.syncedPathChecksums,
    syncedPaths: manifestSubset.syncedPaths,
    generatedPaths: manifestSubset.generatedPaths,
    independentPaths: targetRelease.manifest.independentPaths,
    sourceSnapshot: sourceRelease.snapshot,
    targetSnapshot: targetRelease.snapshot,
    consumerFiles,
    contractSchemaChanged,
  });

  const packageItems = planPackageUpdates({
    repoRoot: options.repoRoot,
    sourceManifest: sourceRelease.manifest,
    targetManifest: targetRelease.manifest,
  });

  const items = mergePlanItems(templatePlan.items, packageItems);
  const summary = summarizeMergedItems(items);
  const conflicts = items.filter((item) => item.conflict);
  const hasBlockingConflicts = conflicts.length > 0;
  const hasIncompleteMigrations = items.some((item) => item.action === "migration");

  const migrationReports: UpgradeMigrationReport[] = buildMigrationReports(
    migrationChain.migrations,
    mode,
    []
  );

  let status: UpgradeRunStatus = "planned";
  const appliedPaths: string[] = [];
  const messages: string[] = [];
  let baselineUpdated = false;
  let validation: UpgradeValidationReport = { doctor: "skipped", apiGen: "skipped" };

  if (hasBlockingConflicts || hasIncompleteMigrations) {
    status = "blocked";
    messages.push(
      hasBlockingConflicts
        ? "Upgrade plan contains blocking conflicts. No filesystem mutations were applied."
        : "Upgrade plan requires structural migrations before template updates can proceed."
    );

    return {
      sourceVersion,
      targetVersion,
      mode,
      status,
      summary,
      items,
      conflicts,
      migrations: migrationReports,
      validation,
      baselineUpdated,
      appliedPaths,
      messages,
    };
  }

  if (mode === "dry-run") {
    messages.push("Dry-run completed. No filesystem mutations were applied.");
    return {
      sourceVersion,
      targetVersion,
      mode,
      status: "planned",
      summary,
      items,
      conflicts,
      migrations: migrationReports,
      validation,
      baselineUpdated,
      appliedPaths,
      messages,
    };
  }

  assertCleanWorktreeForMutation({
    repoRoot: options.repoRoot,
    allowDirty: options.allowDirty ?? false,
  });

  const migrationResults = runMigrationChain(migrationChain.migrations, {
    repoRoot: options.repoRoot,
    dryRun: false,
  });

  for (const migrationResult of migrationResults) {
    migrationReports.push({
      id: migrationResult.migrationId,
      sourceVersion:
        migrationChain.migrations.find((entry) => entry.id === migrationResult.migrationId)
          ?.sourceVersion ?? sourceVersion,
      targetVersion:
        migrationChain.migrations.find((entry) => entry.id === migrationResult.migrationId)
          ?.targetVersion ?? targetVersion,
      description:
        migrationChain.migrations.find((entry) => entry.id === migrationResult.migrationId)
          ?.description ?? "",
      automatic: true,
      status: "applied",
      changedPaths: migrationResult.changedPaths,
      message: migrationResult.message,
    });
  }

  const applyResult = applySafeUpgradeReplacements({
    applicationRoot: applicationAbsoluteRoot,
    plan: {
      ...templatePlan,
      items,
    },
    targetSnapshot: targetRelease.snapshot.syncedPaths,
    dryRun: false,
  });

  for (const appliedItem of applyResult.applied) {
    appliedPaths.push(appliedItem.relativePath);
  }

  const regenerateItems = items.filter((item) => item.action === "regenerate");
  if (regenerateItems.length > 0) {
    const apiGenResult = runApiGen(options.repoRoot);
    validation = {
      doctor: "skipped",
      apiGen: apiGenResult.ok ? "passed" : "failed",
      message: apiGenResult.message,
    };

    if (!apiGenResult.ok) {
      status = "validation-failed";
      messages.push(apiGenResult.message);
      return {
        sourceVersion,
        targetVersion,
        mode,
        status,
        summary,
        items,
        conflicts,
        migrations: migrationReports,
        validation,
        baselineUpdated,
        appliedPaths,
        messages,
      };
    }

    for (const item of regenerateItems) {
      appliedPaths.push(item.relativePath);
    }
  }

  if (!options.skipValidation) {
    const doctorReport = await runDoctor({ cwd: options.repoRoot });
    const doctorFailed = doctorExitCodeIndicatesFailure(doctorReport);
    validation = {
      doctor: doctorFailed ? "failed" : "passed",
      apiGen: validation.apiGen,
      message: doctorFailed ? "atlas doctor reported architectural errors." : undefined,
    };

    if (doctorFailed) {
      status = "validation-failed";
      messages.push("Post-upgrade atlas doctor validation failed. Baseline was not advanced.");
      return {
        sourceVersion,
        targetVersion,
        mode,
        status,
        summary,
        items,
        conflicts,
        migrations: migrationReports,
        validation,
        baselineUpdated,
        appliedPaths,
        messages,
      };
    }
  }

  const refreshedBaseline = captureConsumerPlatformBaseline({
    repoRoot: options.repoRoot,
    applicationRoot,
    atlasVersion: targetVersion,
    contractSchemaVersion: targetRelease.manifest.contractSchemaVersion,
    manifest: manifestSubset,
  });

  writePlatformBaseline(options.repoRoot, contract, refreshedBaseline);
  baselineUpdated = true;
  status = "success";
  messages.push(`Upgrade completed. platform.baseline advanced to Atlas ${targetVersion}.`);

  return {
    sourceVersion,
    targetVersion,
    mode,
    status,
    summary,
    items,
    conflicts,
    migrations: migrationReports,
    validation,
    baselineUpdated,
    appliedPaths,
    messages,
  };
}

export function loadUpgradeReleasePair(options: {
  repoRoot: string;
  sourceVersion: string;
  targetVersion: string;
  releasesDir?: string;
}): {
  sourceRelease: LoadedReleaseSnapshot;
  targetRelease: LoadedReleaseSnapshot;
} {
  return {
    sourceRelease: loadReleaseSnapshot({
      repoRoot: options.repoRoot,
      atlasVersion: options.sourceVersion,
      releasesDir: options.releasesDir,
    }),
    targetRelease: loadReleaseSnapshot({
      repoRoot: options.repoRoot,
      atlasVersion: options.targetVersion,
      releasesDir: options.releasesDir,
    }),
  };
}
