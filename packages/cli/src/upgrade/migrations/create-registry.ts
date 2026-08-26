import { compareAtlasVersions } from "../version-compare";

import type {
  AtlasMigrationDefinition,
  AtlasMigrationRegistry,
  MigrationChainResult,
  MigrationContext,
  MigrationRunner,
  MigrationRunResult,
} from "./types";

export function createMigrationRegistry(options: {
  definitions: AtlasMigrationDefinition[];
  runners: Record<string, MigrationRunner>;
}): AtlasMigrationRegistry {
  const definitions = [...options.definitions];
  const runners = { ...options.runners };

  function resolveChain(sourceVersion: string, targetVersion: string): MigrationChainResult {
    if (sourceVersion === targetVersion) {
      return { migrations: [] };
    }

    const compare = compareAtlasVersions(sourceVersion, targetVersion);
    if (compare > 0) {
      throw new Error(
        `Downgrade from Atlas ${sourceVersion} to ${targetVersion} is not supported.`
      );
    }

    const chain: AtlasMigrationDefinition[] = [];
    let currentVersion = sourceVersion;
    const visited = new Set<string>();

    while (currentVersion !== targetVersion) {
      if (visited.has(currentVersion)) {
        throw new Error(`Migration chain cycle detected at Atlas version ${currentVersion}.`);
      }
      visited.add(currentVersion);

      const nextMigration = definitions.find(
        (migration) => migration.sourceVersion === currentVersion
      );

      if (nextMigration) {
        chain.push(nextMigration);
        currentVersion = nextMigration.targetVersion;

        if (compareAtlasVersions(currentVersion, targetVersion) > 0) {
          return {
            migrations: chain,
            missingTarget: targetVersion,
          };
        }
        continue;
      }

      const remainingMigrations = definitions.filter(
        (migration) =>
          compareAtlasVersions(migration.sourceVersion, currentVersion) > 0 &&
          compareAtlasVersions(migration.sourceVersion, targetVersion) < 0
      );

      if (remainingMigrations.length > 0) {
        return {
          migrations: chain,
          missingTarget: targetVersion,
        };
      }

      return { migrations: chain };
    }

    return { migrations: chain };
  }

  function runMigration(migrationId: string, context: MigrationContext): MigrationRunResult {
    const runner = runners[migrationId];
    if (!runner) {
      throw new Error(`No implementation registered for migration ${migrationId}.`);
    }

    return runner(context);
  }

  function runChain(
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

  function assertChainExecutable(migrations: AtlasMigrationDefinition[]): void {
    for (const migration of migrations) {
      if (!migration.automatic) {
        throw new Error(`Migration ${migration.id} requires manual review.`);
      }

      if (!runners[migration.id]) {
        throw new Error(`No implementation registered for migration ${migration.id}.`);
      }
    }
  }

  return {
    listMigrations: () => [...definitions],
    hasRunner: (migrationId: string) => runners[migrationId] !== undefined,
    resolveChain,
    runMigration,
    runChain,
    assertChainExecutable,
  };
}
