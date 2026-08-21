import type { DoctorDiagnostic, DoctorDiagnosticSeverity } from "./types";

export const DoctorDiagnosticCode = {
  CONTRACT_MISSING: "ATLAS_CONTRACT_MISSING",
  CONTRACT_INVALID: "ATLAS_CONTRACT_INVALID",
  CONTRACT_UNSUPPORTED: "ATLAS_CONTRACT_UNSUPPORTED",
  BOUNDARY_PRIVATE_IMPORT: "ATLAS_BOUNDARY_PRIVATE_IMPORT",
  BOUNDARY_DIRECT_ENV: "ATLAS_BOUNDARY_DIRECT_ENV",
  BOUNDARY_RAW_NETWORK: "ATLAS_BOUNDARY_RAW_NETWORK",
  BOUNDARY_REFERENCE_IMPORT: "ATLAS_BOUNDARY_REFERENCE_IMPORT",
  BOUNDARY_CROSS_FEATURE_IMPORT: "ATLAS_BOUNDARY_CROSS_FEATURE_IMPORT",
  BOUNDARY_ANALYTICS_VENDOR: "ATLAS_BOUNDARY_ANALYTICS_VENDOR",
  ARCHITECTURE_POLICY_MISSING: "ATLAS_ARCHITECTURE_POLICY_MISSING",
  DEPENDENCY_UNDECLARED: "ATLAS_DEPENDENCY_UNDECLARED",
  GENERATED_OPENAPI_STALE: "ATLAS_GENERATED_OPENAPI_STALE",
  GENERATED_OPENAPI_INVALID: "ATLAS_GENERATED_OPENAPI_INVALID",
  VERSION_MISMATCH: "ATLAS_VERSION_MISMATCH",
  ROOT_PACKAGE_METADATA_INVALID: "ATLAS_ROOT_PACKAGE_METADATA_INVALID",
  WORKSPACE_CONFIG_MISSING: "ATLAS_WORKSPACE_CONFIG_MISSING",
  WORKSPACE_PACKAGE_MANIFEST_MISSING: "ATLAS_WORKSPACE_PACKAGE_MANIFEST_MISSING",
  WORKSPACE_NOT_INCLUDED: "ATLAS_WORKSPACE_NOT_INCLUDED",
  DOCTOR_CHECK_EXECUTION_FAILED: "ATLAS_DOCTOR_CHECK_EXECUTION_FAILED",
} as const;

export type DoctorDiagnosticCodeType =
  (typeof DoctorDiagnosticCode)[keyof typeof DoctorDiagnosticCode];

interface DiagnosticDefinition {
  severity: DoctorDiagnosticSeverity;
  suggestedFix: string;
  documentation?: string;
}

export const DOCTOR_DIAGNOSTIC_DEFINITIONS: Record<string, DiagnosticDefinition> = {
  [DoctorDiagnosticCode.CONTRACT_MISSING]: {
    severity: "error",
    suggestedFix:
      "Create atlas.config.json at the repository root or run `atlas init` in a compatible checkout.",
    documentation: "docs/how-we-build/atlas-contract.md",
  },
  [DoctorDiagnosticCode.CONTRACT_INVALID]: {
    severity: "error",
    suggestedFix:
      "Fix atlas.config.json so it validates through @atlas/project, then rerun `atlas doctor`.",
    documentation: "docs/how-we-build/atlas-contract.md",
  },
  [DoctorDiagnosticCode.CONTRACT_UNSUPPORTED]: {
    severity: "error",
    suggestedFix:
      "Upgrade this Atlas checkout or adjust atlas.config.json schemaVersion to a supported version.",
    documentation: "docs/how-we-build/atlas-contract.md",
  },
  [DoctorDiagnosticCode.BOUNDARY_PRIVATE_IMPORT]: {
    severity: "error",
    suggestedFix:
      "Import from the package public entry point (for example `@atlas/ui`) instead of workspace source paths or UI-internal app aliases.",
    documentation: "docs/how-we-build/architecture-ownership.md",
  },
  [DoctorDiagnosticCode.BOUNDARY_DIRECT_ENV]: {
    severity: "error",
    suggestedFix:
      "Use `getServerConfig()` on the server or `useConfig()` on the client instead of direct `process.env` or `@/env` imports.",
    documentation: "docs/how-we-build/architecture-ownership.md",
  },
  [DoctorDiagnosticCode.BOUNDARY_RAW_NETWORK]: {
    severity: "error",
    suggestedFix:
      "Use the central API client from `@/lib/api` instead of raw `fetch()` in application-layer code.",
    documentation: "docs/how-we-build/api.md",
  },
  [DoctorDiagnosticCode.BOUNDARY_REFERENCE_IMPORT]: {
    severity: "error",
    suggestedFix:
      "Do not import reference or example modules from product features. Copy the pattern or extract shared logic to `src/lib/`.",
    documentation: "docs/how-we-build/architecture-ownership.md",
  },
  [DoctorDiagnosticCode.BOUNDARY_CROSS_FEATURE_IMPORT]: {
    severity: "error",
    suggestedFix:
      "Do not import one product feature from another. Extract shared logic to `src/lib/` and import from there.",
    documentation: "docs/how-we-build/architecture-ownership.md",
  },
  [DoctorDiagnosticCode.BOUNDARY_ANALYTICS_VENDOR]: {
    severity: "error",
    suggestedFix:
      "Use the analytics adapter from `@/lib/analytics` instead of importing analytics vendor SDKs directly.",
    documentation: "docs/how-we-build/architecture-ownership.md",
  },
  [DoctorDiagnosticCode.DEPENDENCY_UNDECLARED]: {
    severity: "error",
    suggestedFix:
      "Declare the imported package in the owning workspace package.json dependencies, devDependencies, or peerDependencies.",
    documentation: "docs/how-we-build/folder-structure.md",
  },
  [DoctorDiagnosticCode.GENERATED_OPENAPI_STALE]: {
    severity: "error",
    suggestedFix:
      "Run `pnpm --filter @atlas/web api:gen` and commit the updated OpenAPI client artifact.",
    documentation: "docs/how-we-build/architecture-ownership.md",
  },
  [DoctorDiagnosticCode.GENERATED_OPENAPI_INVALID]: {
    severity: "error",
    suggestedFix:
      "Run the canonical API generation command locally, fix the OpenAPI source or generator error, then rerun `atlas doctor`.",
    documentation: "docs/how-we-build/architecture-ownership.md",
  },
  [DoctorDiagnosticCode.ARCHITECTURE_POLICY_MISSING]: {
    severity: "error",
    suggestedFix:
      "Restore the application ESLint config and architecture policy files required for Atlas boundary enforcement.",
    documentation: "docs/how-we-build/architecture-ownership.md",
  },
  [DoctorDiagnosticCode.ROOT_PACKAGE_METADATA_INVALID]: {
    severity: "error",
    suggestedFix:
      "Restore a valid root package.json with a meaningful version field so Atlas Doctor can compare checkout metadata.",
    documentation: "docs/how-we-build/releases-and-governance.md",
  },
  [DoctorDiagnosticCode.WORKSPACE_CONFIG_MISSING]: {
    severity: "error",
    suggestedFix:
      "Restore pnpm-workspace.yaml and include the configured application and UI workspace roots.",
    documentation: "docs/how-we-build/folder-structure.md",
  },
  [DoctorDiagnosticCode.DOCTOR_CHECK_EXECUTION_FAILED]: {
    severity: "error",
    suggestedFix:
      "Inspect the underlying tooling or configuration error. If the checkout is valid, report this as an Atlas CLI defect.",
  },
  [DoctorDiagnosticCode.VERSION_MISMATCH]: {
    severity: "warning",
    suggestedFix:
      "Align the installed Atlas CLI snapshot with the checkout version, or upgrade using the supported migration path when available.",
    documentation: "docs/how-we-build/releases-and-governance.md",
  },
  [DoctorDiagnosticCode.WORKSPACE_PACKAGE_MANIFEST_MISSING]: {
    severity: "error",
    suggestedFix:
      "Add the missing package.json for the configured Atlas workspace root declared in atlas.config.json.",
    documentation: "docs/how-we-build/atlas-contract.md",
  },
  [DoctorDiagnosticCode.WORKSPACE_NOT_INCLUDED]: {
    severity: "error",
    suggestedFix:
      "Include the configured Atlas workspace root in pnpm-workspace.yaml so pnpm discovers the package.",
    documentation: "docs/how-we-build/folder-structure.md",
  },
};

export function createCheckExecutionFailedDiagnostic(
  checkId: string,
  reason?: string
): DoctorDiagnostic {
  const reasonSuffix = reason ? `: ${reason}` : "";
  return createDiagnostic(
    DoctorDiagnosticCode.DOCTOR_CHECK_EXECUTION_FAILED,
    `Doctor could not execute the "${checkId}" check${reasonSuffix}.`
  );
}

export function createDiagnostic(
  code: string,
  message: string,
  options?: {
    path?: string;
    line?: number;
    column?: number;
    suggestedFix?: string;
    documentation?: string;
    severity?: DoctorDiagnosticSeverity;
  }
): DoctorDiagnostic {
  const definition = DOCTOR_DIAGNOSTIC_DEFINITIONS[code];
  return {
    code,
    severity: options?.severity ?? definition?.severity ?? "error",
    message,
    suggestedFix:
      options?.suggestedFix ?? definition?.suggestedFix ?? "Review the Atlas architecture docs.",
    documentation: options?.documentation ?? definition?.documentation,
    path: options?.path,
    line: options?.line,
    column: options?.column,
  };
}
