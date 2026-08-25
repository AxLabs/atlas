import { existsSync } from "node:fs";
import path from "node:path";

import { compareAppInfrastructureManifest } from "../template-sync/compare";
import { loadAppInfrastructureManifest, resolveManifestPath } from "../template-sync/manifest";

import { createDiagnostic, DoctorDiagnosticCode } from "./diagnostics";

import type { DoctorContext } from "./context";
import type { DoctorCheckResult } from "./types";

export function runTemplateInfrastructureSyncCheck(context: DoctorContext): DoctorCheckResult {
  const base = {
    id: "template-infrastructure-sync",
    title: "Template infrastructure sync",
    rationale:
      "Starter and reference applications duplicate Atlas template infrastructure deliberately; synced paths must stay aligned with the canonical starter unless documented as application-owned.",
  };

  if (!context.project) {
    return {
      ...base,
      status: "skip",
      diagnostics: [],
      skipReason: "Project contract is invalid or missing.",
    };
  }

  const manifestPath = resolveManifestPath(context.repoRoot);
  if (!existsSync(manifestPath)) {
    return {
      ...base,
      status: "skip",
      diagnostics: [],
      skipReason: "Application infrastructure manifest is not present in this workspace.",
    };
  }

  try {
    const manifest = loadAppInfrastructureManifest(context.repoRoot);

    const canonicalRoot = path.join(context.repoRoot, manifest.canonicalApplication);
    if (!existsSync(canonicalRoot)) {
      return {
        ...base,
        status: "skip",
        diagnostics: [],
        skipReason: "Canonical starter application is not present in this workspace.",
      };
    }

    const missingConsumers = manifest.consumerApplications.filter(
      (application) => !existsSync(path.join(context.repoRoot, application))
    );
    if (missingConsumers.length > 0) {
      return {
        ...base,
        status: "skip",
        diagnostics: [],
        skipReason:
          "Consumer applications for template infrastructure sync are not present in this workspace.",
      };
    }

    const comparison = compareAppInfrastructureManifest(context.repoRoot, manifest);
    const diagnostics = [];

    for (const drift of comparison.drifts) {
      const code =
        drift.kind === "missing-in-canonical"
          ? DoctorDiagnosticCode.TEMPLATE_SYNC_CANONICAL_MISSING
          : DoctorDiagnosticCode.TEMPLATE_SYNC_DRIFT;

      diagnostics.push(
        createDiagnostic(code, drift.message, {
          path: pathForApplication(drift.consumerApplication, drift.relativePath),
        })
      );
    }

    for (const issue of comparison.structuralIssues) {
      diagnostics.push(
        createDiagnostic(DoctorDiagnosticCode.TEMPLATE_SYNC_STRUCTURE, issue.message, {
          path: pathForApplication(issue.application, issue.relativePath),
        })
      );
    }

    return {
      ...base,
      status: diagnostics.length > 0 ? "fail" : "pass",
      diagnostics,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Application infrastructure manifest could not be loaded.";

    return {
      ...base,
      status: "fail",
      diagnostics: [
        createDiagnostic(DoctorDiagnosticCode.TEMPLATE_SYNC_MANIFEST_INVALID, message, {
          path: "templates/app-infrastructure.manifest.json",
        }),
      ],
    };
  }
}

function pathForApplication(application: string, relativePath: string): string {
  return path.posix.join(application, relativePath);
}
