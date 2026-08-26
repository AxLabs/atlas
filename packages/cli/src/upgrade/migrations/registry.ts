import { compareAtlasVersions } from "../version-compare";

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
    id: "noop-0.1.0-to-0.2.0",
    sourceVersion: "0.1.0",
    targetVersion: "0.2.0",
    description:
      "No structural contract transformation required between Atlas 0.1.0 and 0.2.0 in this rehearsal chain.",
    automatic: true,
    reversible: false,
  },
];

const MIGRATION_RUNNERS: Record<string, (context: MigrationContext) => MigrationRunResult> = {
  "noop-0.1.0-to-0.2.0": (context) => ({
    migrationId: "noop-0.1.0-to-0.2.0",
    changedPaths: [],
    message: context.dryRun
      ? "Migration noop-0.1.0-to-0.2.0 would run (no file changes)."
      : "Migration noop-0.1.0-to-0.2.0 completed (no file changes).",
  }),
};

export function listRegisteredMigrations(): AtlasMigrationDefinition[] {
  return [...MIGRATION_DEFINITIONS];
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
