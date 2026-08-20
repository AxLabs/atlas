import {
  runArchitectureBoundariesCheck,
  runAtlasVersionCheck,
  runDependencyDeclarationsCheck,
  runGeneratedOpenApiCheck,
  runProjectContractCheck,
  runWorkspaceStructureCheck,
} from "./checks";
import { sortDiagnostics } from "./map-eslint";
import { DOCTOR_REPORT_SCHEMA_VERSION } from "./types";

import type { DoctorContext } from "./context";
import type {
  DoctorCheckDefinition,
  DoctorCheckResult,
  DoctorDiagnostic,
  DoctorReport,
  DoctorReportStatus,
  DoctorReportSummary,
} from "./types";

export const DOCTOR_CHECKS: DoctorCheckDefinition[] = [
  {
    id: "project-contract",
    title: "Project contract",
    rationale:
      "Atlas tooling cannot reason reliably about architecture without a valid atlas.config.json contract resolved through @atlas/project.",
    run: runProjectContractCheck,
  },
  {
    id: "workspace-structure",
    title: "Workspace structure",
    rationale:
      "Configured Atlas workspace roots must exist and be discoverable by pnpm for reliable package boundaries.",
    run: runWorkspaceStructureCheck,
  },
  {
    id: "architecture-boundaries",
    title: "Architecture boundaries",
    rationale:
      "Source bypassing owned boundaries makes migrations, hoisting assumptions, and agent behavior less predictable.",
    run: runArchitectureBoundariesCheck,
  },
  {
    id: "dependency-declarations",
    title: "Dependency declarations",
    rationale:
      "pnpm workspace hoisting can hide undeclared dependency reliance that regresses when package graphs change.",
    run: runDependencyDeclarationsCheck,
  },
  {
    id: "generated-openapi",
    title: "Generated OpenAPI",
    rationale:
      "When OpenAPI is enabled, generated client artifacts must match the canonical spec deterministically.",
    run: runGeneratedOpenApiCheck,
  },
  {
    id: "atlas-version",
    title: "Atlas version",
    rationale:
      "The installed Atlas CLI snapshot should match the checkout version to avoid tooling/project drift during future migrations.",
    run: runAtlasVersionCheck,
  },
];

export async function runDoctorChecks(context: DoctorContext): Promise<DoctorReport> {
  const checks: DoctorCheckResult[] = [];

  for (const check of DOCTOR_CHECKS) {
    try {
      checks.push(await check.run(context));
    } catch (error) {
      checks.push({
        id: check.id,
        title: check.title,
        rationale: check.rationale,
        status: "fail",
        diagnostics: [
          {
            code: "DOCTOR_CHECK_EXECUTION_FAILED",
            severity: "error",
            message:
              error instanceof Error
                ? `Doctor could not execute check "${check.id}": ${error.message}`
                : `Doctor could not execute check "${check.id}".`,
            suggestedFix: "Report this as an Atlas CLI internal error if it persists.",
          },
        ],
      });
    }
  }

  const diagnostics = sortDiagnostics(flattenDiagnostics(checks));
  const summary = summarizeChecks(checks, diagnostics);

  return {
    schemaVersion: DOCTOR_REPORT_SCHEMA_VERSION,
    status: deriveReportStatus(summary),
    atlasVersion: context.atlasVersion,
    projectRoot: context.projectRootRelative,
    summary,
    checks,
    diagnostics,
  };
}

function flattenDiagnostics(checks: DoctorCheckResult[]): DoctorDiagnostic[] {
  const seen = new Set<string>();
  const flattened: DoctorDiagnostic[] = [];

  for (const check of checks) {
    for (const diagnostic of check.diagnostics) {
      const key = [
        diagnostic.code,
        diagnostic.path ?? "",
        diagnostic.line ?? "",
        diagnostic.column ?? "",
        diagnostic.message,
      ].join("|");

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      flattened.push(diagnostic);
    }
  }

  return flattened;
}

function summarizeChecks(
  checks: DoctorCheckResult[],
  diagnostics: DoctorDiagnostic[]
): DoctorReportSummary {
  return {
    passed: checks.filter((check) => check.status === "pass").length,
    warnings: checks.filter((check) => check.status === "warn").length,
    errors: diagnostics.filter((diagnostic) => diagnostic.severity === "error").length,
    skipped: checks.filter((check) => check.status === "skip").length,
  };
}

function deriveReportStatus(summary: DoctorReportSummary): DoctorReportStatus {
  if (summary.errors > 0) {
    return "failed";
  }

  if (summary.warnings > 0) {
    return "warning";
  }

  return "healthy";
}

export function doctorReportHasErrors(report: DoctorReport): boolean {
  return report.summary.errors > 0;
}
