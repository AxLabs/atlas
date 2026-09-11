import { existsSync } from "node:fs";
import path from "node:path";

import { validatePlatformBaselineIntegrity } from "@atlas/project";

import {
  loadAppInfrastructureManifest,
  resolveManifestPath,
  SUPPORTED_APP_INFRASTRUCTURE_MANIFEST_SCHEMA_VERSION,
} from "../template-sync/manifest";

import { createDiagnostic, DoctorDiagnosticCode } from "./diagnostics";

import type { DoctorContext } from "./context";
import type { DoctorCheckResult } from "./types";

export function runUpgradeBaselineCheck(context: DoctorContext): DoctorCheckResult {
  const base = {
    id: "upgrade-baseline",
    title: "Upgrade baseline",
    rationale:
      "Atlas records platform baseline metadata so future upgrades can distinguish unchanged template infrastructure from consumer modifications.",
  };

  if (!context.project || !context.rawContract) {
    return {
      ...base,
      status: "skip",
      diagnostics: [],
      skipReason: "Project contract is invalid or missing.",
    };
  }

  const baseline = context.rawContract.platform?.baseline;
  if (!baseline) {
    return {
      ...base,
      status: "warn",
      diagnostics: [
        createDiagnostic(
          DoctorDiagnosticCode.UPGRADE_BASELINE_MISSING,
          "Atlas upgrade baseline metadata is missing from atlas.config.json. Future upgrades cannot detect consumer modifications to synced template infrastructure.",
          {
            path: "atlas.config.json",
            suggestedFix:
              "Re-run `atlas init` on a compatible checkout or record `platform.baseline` using the Atlas upgrade baseline capture helpers before attempting upgrades.",
          }
        ),
      ],
    };
  }

  const diagnostics = [];

  if (context.checkoutAtlasVersion && baseline.atlasVersion !== context.checkoutAtlasVersion) {
    diagnostics.push(
      createDiagnostic(
        DoctorDiagnosticCode.UPGRADE_BASELINE_STALE,
        `Recorded Atlas baseline version ${baseline.atlasVersion} differs from checkout version ${context.checkoutAtlasVersion}.`,
        {
          path: "atlas.config.json",
          suggestedFix:
            "Review docs/how-we-build/upgrades.md and update platform.baseline after completing a supported upgrade path (`atlas upgrade` automates this).",
        }
      )
    );
  }

  const manifestPath = resolveManifestPath(context.repoRoot);
  if (!existsSync(manifestPath)) {
    if (diagnostics.length > 0) {
      return {
        ...base,
        status: "warn",
        diagnostics,
      };
    }

    return {
      ...base,
      status: "pass",
      diagnostics: [],
    };
  }

  try {
    const manifest = loadAppInfrastructureManifest(context.repoRoot);
    const integrityIssues = validatePlatformBaselineIntegrity({
      baseline,
      expectedSyncedPaths: manifest.syncedPaths,
      currentManifestSchemaVersion: SUPPORTED_APP_INFRASTRUCTURE_MANIFEST_SCHEMA_VERSION,
    });

    for (const issue of integrityIssues) {
      const diagnosticPath = issue.relativePath
        ? path.posix.join(manifest.canonicalApplication, issue.relativePath)
        : "atlas.config.json";

      switch (issue.kind) {
        case "missing-synced-path":
          diagnostics.push(
            createDiagnostic(DoctorDiagnosticCode.UPGRADE_BASELINE_INCOMPLETE, issue.message, {
              path: diagnosticPath,
              severity: "error",
              suggestedFix:
                "Re-capture platform.baseline with `pnpm --filter @atlas/project capture-baseline` after restoring missing synced infrastructure files, or complete a supported upgrade path documented in docs/how-we-build/upgrades.md.",
            })
          );
          break;
        case "invalid-checksum":
          diagnostics.push(
            createDiagnostic(
              DoctorDiagnosticCode.UPGRADE_BASELINE_CHECKSUM_INVALID,
              issue.message,
              {
                path: diagnosticPath,
                severity: "error",
                suggestedFix:
                  "Replace malformed checksum values in platform.baseline.syncedPathChecksums with sha256:<64 hex characters> captured from the consumer application, or re-run baseline capture on a healthy checkout.",
              }
            )
          );
          break;
        case "manifest-schema-mismatch":
          diagnostics.push(
            createDiagnostic(
              DoctorDiagnosticCode.UPGRADE_BASELINE_MANIFEST_INCOMPATIBLE,
              issue.message,
              {
                path: "atlas.config.json",
                severity: "warning",
                suggestedFix:
                  "Refresh platform.baseline after adopting the current template manifest schema version, or step through the documented migration chain before upgrading.",
              }
            )
          );
          break;
        case "stale-baseline-entry":
          diagnostics.push(
            createDiagnostic(DoctorDiagnosticCode.UPGRADE_BASELINE_STALE_ENTRY, issue.message, {
              path: diagnosticPath,
              severity: "warning",
              suggestedFix:
                "Remove stale baseline checksum entries or re-capture platform.baseline after completing a supported upgrade so checksum evidence matches the current manifest syncedPaths.",
            })
          );
          break;
        default:
          break;
      }
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Application infrastructure manifest could not be loaded for baseline integrity validation.";

    diagnostics.push(
      createDiagnostic(DoctorDiagnosticCode.TEMPLATE_SYNC_MANIFEST_INVALID, message, {
        path: "templates/app-infrastructure.manifest.json",
        severity: "warning",
      })
    );
  }

  const hasErrors = diagnostics.some((diagnostic) => diagnostic.severity === "error");
  let status: DoctorCheckResult["status"] = "pass";
  if (hasErrors) {
    status = "fail";
  } else if (diagnostics.length > 0) {
    status = "warn";
  }

  return {
    ...base,
    status,
    diagnostics,
  };
}
