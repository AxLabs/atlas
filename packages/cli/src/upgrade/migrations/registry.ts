import { compareAtlasVersions } from "../version-compare";

import { runAtlasContractV1ToV2, runAtlasRehearsalStepA } from "./atlas-contract-migrations";

export interface AtlasMigrationDefinition {
  id: string;
  sourceVersion: string;
  targetVersion: string;
  description: string;
  automatic: boolean;
  reversible: boolean;
}

export interface MigrationContext {
  repoRoot: string;
  dryRun: boolean;
}

export interface MigrationRunResult {
  migrationId: string;
  changedPaths: string[];
  message: string;
}

export interface MigrationChainResult {
  migrations: AtlasMigrationDefinition[];
  missingTarget?: string;
}

/** Versioned migration registry. Migrations apply structural/breaking transformations only. */
const MIGRATION_DEFINITIONS: AtlasMigrationDefinition[] = [
  {
    id: "atlas-rehearsal-step-a",
    sourceVersion: "0.1.0",
    targetVersion: "0.2.0",
    description:
      "Record Atlas upgrade rehearsal step A in atlas.config.json before template updates apply.",
    automatic: true,
    reversible: false,
  },
  {
    id: "atlas-contract-v1-to-v2",
    sourceVersion: "0.2.0",
    targetVersion: "0.3.0",
    description:
      "Transform platform.migrationRehearsal legacyFlag into newFlag for contract schema version 2.",
    automatic: true,
    reversible: false,
  },
];

const MIGRATION_RUNNERS: Record<string, (context: MigrationContext) => MigrationRunResult> = {
  "atlas-rehearsal-step-a": runAtlasRehearsalStepA,
  "atlas-contract-v1-to-v2": runAtlasContractV1ToV2,
};

export function listRegisteredMigrations(): AtlasMigrationDefinition[] {
  return [...MIGRATION_DEFINITIONS];
}

export function hasMigrationRunner(migrationId: string): boolean {
  return MIGRATION_RUNNERS[migrationId] !== undefined;
}

export function resolveMigrationChain(
  sourceVersion: string,
  targetVersion: string
): MigrationChainResult {
  if (sourceVersion === targetVersion) {
    return { migrations: [] };
  }

  const compare = compareAtlasVersions(sourceVersion, targetVersion);
  if (compare > 0) {
    throw new Error(`Downgrade from Atlas ${sourceVersion} to ${targetVersion} is not supported.`);
  }

  const chain: AtlasMigrationDefinition[] = [];
  let currentVersion = sourceVersion;
  const visited = new Set<string>();

  while (currentVersion !== targetVersion) {
    if (visited.has(currentVersion)) {
      throw new Error(`Migration chain cycle detected at Atlas version ${currentVersion}.`);
    }
    visited.add(currentVersion);

    const nextMigration = MIGRATION_DEFINITIONS.find(
      (migration) => migration.sourceVersion === currentVersion
    );

    if (!nextMigration) {
      return {
        migrations: chain,
        missingTarget: targetVersion,
      };
    }

    chain.push(nextMigration);
    currentVersion = nextMigration.targetVersion;

    if (compareAtlasVersions(currentVersion, targetVersion) > 0) {
      return {
        migrations: chain,
        missingTarget: targetVersion,
      };
    }
  }

  return { migrations: chain };
}

export function runMigration(migrationId: string, context: MigrationContext): MigrationRunResult {
  const runner = MIGRATION_RUNNERS[migrationId];
  if (!runner) {
    throw new Error(`No implementation registered for migration ${migrationId}.`);
  }

  return runner(context);
}

export function runMigrationChain(
  migrations: AtlasMigrationDefinition[],
  context: MigrationContext
): MigrationRunResult[] {
  const results: MigrationRunResult[] = [];

  for (const migration of migrations) {
    if (!migration.automatic) {
      throw new Error(
        `Migration ${migration.id} requires manual review and cannot run automatically.`
      );
    }

    results.push(runMigration(migration.id, context));
  }

  return results;
}

export function assertMigrationChainExecutable(migrations: AtlasMigrationDefinition[]): void {
  for (const migration of migrations) {
    if (!migration.automatic) {
      throw new Error(`Migration ${migration.id} requires manual review.`);
    }

    if (!hasMigrationRunner(migration.id)) {
      throw new Error(`No implementation registered for migration ${migration.id}.`);
    }
  }
}
