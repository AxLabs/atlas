import { createMigrationRegistry } from "./create-registry";

import type { AtlasMigrationRegistry } from "./types";

export type {
  AtlasMigrationDefinition,
  AtlasMigrationRegistry,
  MigrationChainResult,
  MigrationContext,
  MigrationRunResult,
} from "./types";

/** Production migration registry — genuine Atlas structural migrations only. */
export const PRODUCTION_MIGRATION_REGISTRY: AtlasMigrationRegistry = createMigrationRegistry({
  definitions: [],
  runners: {},
});

export function listRegisteredMigrations(): ReturnType<AtlasMigrationRegistry["listMigrations"]> {
  return PRODUCTION_MIGRATION_REGISTRY.listMigrations();
}

export function hasMigrationRunner(migrationId: string): boolean {
  return PRODUCTION_MIGRATION_REGISTRY.hasRunner(migrationId);
}

export function resolveMigrationChain(
  sourceVersion: string,
  targetVersion: string,
  registry: AtlasMigrationRegistry = PRODUCTION_MIGRATION_REGISTRY
) {
  return registry.resolveChain(sourceVersion, targetVersion);
}

export function runMigration(
  migrationId: string,
  context: Parameters<AtlasMigrationRegistry["runMigration"]>[1],
  registry: AtlasMigrationRegistry = PRODUCTION_MIGRATION_REGISTRY
) {
  return registry.runMigration(migrationId, context);
}

export function runMigrationChain(
  migrations: Parameters<AtlasMigrationRegistry["runChain"]>[0],
  context: Parameters<AtlasMigrationRegistry["runChain"]>[1],
  registry: AtlasMigrationRegistry = PRODUCTION_MIGRATION_REGISTRY
) {
  return registry.runChain(migrations, context);
}

export function assertMigrationChainExecutable(
  migrations: Parameters<AtlasMigrationRegistry["assertChainExecutable"]>[0],
  registry: AtlasMigrationRegistry = PRODUCTION_MIGRATION_REGISTRY
): void {
  registry.assertChainExecutable(migrations);
}
