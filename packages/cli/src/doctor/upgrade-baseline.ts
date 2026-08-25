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

  if (context.checkoutAtlasVersion && baseline.atlasVersion !== context.checkoutAtlasVersion) {
    return {
      ...base,
      status: "warn",
      diagnostics: [
        createDiagnostic(
          DoctorDiagnosticCode.UPGRADE_BASELINE_STALE,
          `Recorded Atlas baseline version ${baseline.atlasVersion} differs from checkout version ${context.checkoutAtlasVersion}.`,
          {
            path: "atlas.config.json",
            suggestedFix:
              "Review docs/how-we-build/upgrades.md and update platform.baseline after completing a supported upgrade path (#43 will automate this).",
          }
        ),
      ],
    };
  }

  return {
    ...base,
    status: "pass",
    diagnostics: [],
  };
}
