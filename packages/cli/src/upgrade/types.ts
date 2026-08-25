export type UpgradeOwnershipChannel =
  | "versioned-package"
  | "generated-artifact"
  | "atlas-managed-template"
  | "consumer-owned-source"
  | "structural-contract"
  | "migration-managed"
  | "documentation-procedure"
  | "reference-only";

export type UpgradeChangeCategory =
  | "patch-safe"
  | "merge-required"
  | "migration-required"
  | "manual"
  | "security-critical";

export type UpgradeActionKind =
  | "replace"
  | "regenerate"
  | "package-upgrade"
  | "skip"
  | "manual-review"
  | "migration";

export interface UpgradePlanItem {
  relativePath: string;
  ownershipChannel: UpgradeOwnershipChannel;
  category: UpgradeChangeCategory;
  action: UpgradeActionKind;
  message: string;
  conflict: boolean;
}

export interface UpgradePlanSummary {
  patchSafe: number;
  mergeRequired: number;
  migrationRequired: number;
  manual: number;
  securityCritical: number;
  skipped: number;
}

export interface UpgradePlan {
  sourceAtlasVersion: string;
  targetAtlasVersion: string;
  applicationRoot: string;
  items: UpgradePlanItem[];
  summary: UpgradePlanSummary;
  hasBlockingConflicts: boolean;
  hasIncompleteMigrations: boolean;
}

export interface UpgradeSnapshot {
  syncedPaths: Record<string, string>;
  generatedPaths?: Record<string, string>;
  openApiSpec?: string;
}

export interface PlanUpgradeOptions {
  applicationRoot: string;
  baselineAtlasVersion: string;
  targetAtlasVersion: string;
  baselineChecksums: Record<string, string>;
  syncedPaths: string[];
  generatedPaths: string[];
  independentPaths: string[];
  sourceSnapshot: UpgradeSnapshot;
  targetSnapshot: UpgradeSnapshot;
  consumerFiles: Record<string, string>;
  contractSchemaChanged?: boolean;
}
