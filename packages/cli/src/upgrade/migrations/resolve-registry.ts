import { existsSync } from "node:fs";
import path from "node:path";

import { FIXTURE_MIGRATION_REGISTRY } from "./fixture-registry";
import { PRODUCTION_MIGRATION_REGISTRY } from "./registry";

import type { AtlasMigrationRegistry } from "./types";

export const FIXTURE_UPGRADE_MARKER = ".atlas-upgrade-fixture";

export function resolveUpgradeMigrationRegistry(options: {
  repoRoot: string;
  migrationRegistry?: AtlasMigrationRegistry;
}): AtlasMigrationRegistry {
  if (options.migrationRegistry) {
    return options.migrationRegistry;
  }

  if (existsSync(path.join(options.repoRoot, FIXTURE_UPGRADE_MARKER))) {
    return FIXTURE_MIGRATION_REGISTRY;
  }

  return PRODUCTION_MIGRATION_REGISTRY;
}
