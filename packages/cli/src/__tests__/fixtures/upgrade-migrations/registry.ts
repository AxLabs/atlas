import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createMigrationRegistry } from "../../../upgrade/migrations/create-registry";

import type { MigrationContext, MigrationRunResult } from "../../../upgrade/migrations/types";

export const FIXTURE_CONTRACT_FILENAME = "fixture.contract.json";

interface FixtureContract {
  schemaVersion?: number;
  legacyKey?: boolean;
  newKey?: boolean;
  stepA?: boolean;
  stepB?: boolean;
  [key: string]: unknown;
}

function readFixtureContract(repoRoot: string): FixtureContract {
  const contractPath = path.join(repoRoot, FIXTURE_CONTRACT_FILENAME);
  return JSON.parse(readFileSync(contractPath, "utf8")) as FixtureContract;
}

function writeFixtureContract(repoRoot: string, contract: FixtureContract): void {
  const contractPath = path.join(repoRoot, FIXTURE_CONTRACT_FILENAME);
  writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`, "utf8");
}

function runFixtureMigrationA(context: MigrationContext): MigrationRunResult {
  const migrationId = "fixture-migration-a";

  if (context.dryRun) {
    return {
      migrationId,
      changedPaths: [FIXTURE_CONTRACT_FILENAME],
      message: `Migration ${migrationId} would record fixture step A and legacyKey in ${FIXTURE_CONTRACT_FILENAME}.`,
    };
  }

  const contract = readFixtureContract(context.repoRoot);
  contract.schemaVersion = 1;
  contract.stepA = true;
  contract.legacyKey = true;

  writeFixtureContract(context.repoRoot, contract);

  return {
    migrationId,
    changedPaths: [FIXTURE_CONTRACT_FILENAME],
    message: `Migration ${migrationId} recorded fixture step A and legacyKey in ${FIXTURE_CONTRACT_FILENAME}.`,
  };
}

function runFixtureMigrationB(context: MigrationContext): MigrationRunResult {
  const migrationId = "fixture-migration-b";

  if (context.dryRun) {
    return {
      migrationId,
      changedPaths: [FIXTURE_CONTRACT_FILENAME],
      message: `Migration ${migrationId} would transform fixture legacyKey into newKey.`,
    };
  }

  const contract = readFixtureContract(context.repoRoot);
  const legacyKey = contract.legacyKey === true;

  contract.schemaVersion = 2;
  contract.stepB = true;
  contract.newKey = legacyKey;
  delete contract.legacyKey;
  delete contract.stepA;

  writeFixtureContract(context.repoRoot, contract);

  return {
    migrationId,
    changedPaths: [FIXTURE_CONTRACT_FILENAME],
    message: `Migration ${migrationId} transformed fixture legacyKey into newKey.`,
  };
}

/** Synthetic migration registry for integration tests — never imported by production code. */
export const FIXTURE_MIGRATION_REGISTRY = createMigrationRegistry({
  definitions: [
    {
      id: "fixture-migration-a",
      sourceVersion: "0.1.0",
      targetVersion: "0.2.0",
      description:
        "Record fixture step A and legacyKey in fixture.contract.json before template updates apply.",
      automatic: true,
      reversible: false,
    },
    {
      id: "fixture-migration-b",
      sourceVersion: "0.2.0",
      targetVersion: "0.3.0",
      description:
        "Transform fixture legacyKey into newKey and bump fixture.contract.json schemaVersion to 2.",
      automatic: true,
      reversible: false,
    },
  ],
  runners: {
    "fixture-migration-a": runFixtureMigrationA,
    "fixture-migration-b": runFixtureMigrationB,
  },
});
