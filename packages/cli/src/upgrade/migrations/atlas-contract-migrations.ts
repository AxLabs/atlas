import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { ATLAS_CONTRACT_FILENAME } from "@atlas/project";

import type { MigrationContext, MigrationRunResult } from "./registry";

const MIGRATION_REHEARSAL_FIELD = "migrationRehearsal";

interface RehearsalContract {
  schemaVersion?: number;
  platform?: {
    migrationRehearsal?: Record<string, unknown>;
    baseline?: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function readContract(repoRoot: string): RehearsalContract {
  const contractPath = path.join(repoRoot, ATLAS_CONTRACT_FILENAME);
  return JSON.parse(readFileSync(contractPath, "utf8")) as RehearsalContract;
}

function writeContract(repoRoot: string, contract: RehearsalContract): void {
  const contractPath = path.join(repoRoot, ATLAS_CONTRACT_FILENAME);
  writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`, "utf8");
}

export function runAtlasRehearsalStepA(context: MigrationContext): MigrationRunResult {
  const migrationId = "atlas-rehearsal-step-a";

  if (context.dryRun) {
    return {
      migrationId,
      changedPaths: [ATLAS_CONTRACT_FILENAME],
      message: `Migration ${migrationId} would record rehearsal step A in atlas.config.json.`,
    };
  }

  const contract = readContract(context.repoRoot);
  contract.platform = contract.platform ?? {};
  contract.platform[MIGRATION_REHEARSAL_FIELD] = {
    ...(contract.platform[MIGRATION_REHEARSAL_FIELD] ?? {}),
    stepA: true,
    legacyFlag: true,
  };

  writeContract(context.repoRoot, contract);

  return {
    migrationId,
    changedPaths: [ATLAS_CONTRACT_FILENAME],
    message: `Migration ${migrationId} recorded rehearsal step A in atlas.config.json.`,
  };
}

export function runAtlasContractV1ToV2(context: MigrationContext): MigrationRunResult {
  const migrationId = "atlas-contract-v1-to-v2";

  if (context.dryRun) {
    return {
      migrationId,
      changedPaths: [ATLAS_CONTRACT_FILENAME],
      message: `Migration ${migrationId} would transform platform.migrationRehearsal legacyFlag to newFlag.`,
    };
  }

  const contract = readContract(context.repoRoot);
  const rehearsal = contract.platform?.[MIGRATION_REHEARSAL_FIELD];
  const legacyFlag =
    typeof rehearsal === "object" && rehearsal !== null && "legacyFlag" in rehearsal
      ? rehearsal.legacyFlag
      : undefined;

  contract.platform = contract.platform ?? {};
  contract.platform[MIGRATION_REHEARSAL_FIELD] = {
    ...(typeof rehearsal === "object" && rehearsal !== null ? rehearsal : {}),
    stepB: true,
    newFlag: legacyFlag === true,
  };

  if (
    typeof contract.platform[MIGRATION_REHEARSAL_FIELD] === "object" &&
    contract.platform[MIGRATION_REHEARSAL_FIELD] !== null
  ) {
    delete (contract.platform[MIGRATION_REHEARSAL_FIELD] as Record<string, unknown>).legacyFlag;
    delete (contract.platform[MIGRATION_REHEARSAL_FIELD] as Record<string, unknown>).stepA;
  }

  writeContract(context.repoRoot, contract);

  return {
    migrationId,
    changedPaths: [ATLAS_CONTRACT_FILENAME],
    message: `Migration ${migrationId} transformed platform.migrationRehearsal legacyFlag to newFlag.`,
  };
}
