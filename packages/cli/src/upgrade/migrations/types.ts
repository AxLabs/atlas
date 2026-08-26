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

export type MigrationRunner = (context: MigrationContext) => MigrationRunResult;

export interface AtlasMigrationRegistry {
  listMigrations(): AtlasMigrationDefinition[];
  hasRunner(migrationId: string): boolean;
  resolveChain(sourceVersion: string, targetVersion: string): MigrationChainResult;
  runMigration(migrationId: string, context: MigrationContext): MigrationRunResult;
  runChain(migrations: AtlasMigrationDefinition[], context: MigrationContext): MigrationRunResult[];
  assertChainExecutable(migrations: AtlasMigrationDefinition[]): void;
}
