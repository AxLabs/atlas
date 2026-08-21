import { mapContractErrorToDiagnostics } from "../doctor/map-contract-error";
import {
  assertNoFatalEslintResults,
  extractEslintExecutionFailure,
} from "../doctor/eslint-execution";
import { mapEslintMessageToDiagnostic, sortDiagnostics } from "../doctor/map-eslint";
import { DoctorDiagnosticCode } from "../doctor/diagnostics";
import { createDoctorContext } from "../doctor/context";
import { findCrossFeatureImportDiagnostics } from "../doctor/cross-feature-imports";
import { resolveProductFeaturePolicyTarget } from "../doctor/feature-alias";
import { createDoctorAtlasFixture } from "./helpers/doctor-fixture";
import { AtlasContractError, AtlasContractErrorCode } from "@atlas/project";

describe("doctor contract mapping", () => {
  it("maps missing contracts to ATLAS_CONTRACT_MISSING", () => {
    const diagnostics = mapContractErrorToDiagnostics(
      new AtlasContractError(
        AtlasContractErrorCode.CONTRACT_NOT_FOUND,
        "Atlas contract not found at atlas.config.json."
      )
    );

    expect(diagnostics[0]?.code).toBe(DoctorDiagnosticCode.CONTRACT_MISSING);
  });
});

describe("doctor eslint mapping", () => {
  it("maps tagged ESLint messages to stable diagnostics", () => {
    const diagnostic = mapEslintMessageToDiagnostic("/repo", "/repo/apps/web", {
      ruleId: "no-restricted-imports",
      message:
        "Do not import workspace package source directly.\n@atlas-doctor:ATLAS_BOUNDARY_PRIVATE_IMPORT",
      line: 1,
      column: 1,
      filePath: "/repo/apps/web/src/features/example.ts",
    });

    expect(diagnostic?.code).toBe(DoctorDiagnosticCode.BOUNDARY_PRIVATE_IMPORT);
    expect(diagnostic?.path).toBe("apps/web/src/features/example.ts");
  });

  it("sorts diagnostics deterministically", () => {
    const sorted = sortDiagnostics([
      {
        code: DoctorDiagnosticCode.BOUNDARY_RAW_NETWORK,
        severity: "error",
        message: "b",
        suggestedFix: "fix",
        path: "apps/web/b.ts",
      },
      {
        code: DoctorDiagnosticCode.BOUNDARY_DIRECT_ENV,
        severity: "error",
        message: "a",
        suggestedFix: "fix",
        path: "apps/web/a.ts",
      },
    ]);

    expect(sorted.map((diagnostic) => diagnostic.path)).toEqual(["apps/web/a.ts", "apps/web/b.ts"]);
  });

  it("detects fatal ESLint parser failures", () => {
    const failure = extractEslintExecutionFailure("/repo", [
      {
        filePath: "/repo/apps/web/src/domains/billing/broken.ts",
        messages: [
          {
            ruleId: null,
            severity: 2,
            message: "Parsing error: Expression expected.",
            line: 2,
            column: 9,
            fatal: true,
          },
        ],
        suppressedMessages: [],
        errorCount: 1,
        fatalErrorCount: 1,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
        usedDeprecatedRules: [],
      },
    ]);

    expect(failure).toBe(
      "Parsing error in apps/web/src/domains/billing/broken.ts: Parsing error: Expression expected."
    );
    expect(() =>
      assertNoFatalEslintResults("/repo", [
        {
          filePath: "/repo/apps/web/src/domains/billing/broken.ts",
          messages: [
            {
              ruleId: null,
              severity: 2,
              message: "Parsing error: Expression expected.",
              line: 2,
              column: 9,
              fatal: true,
            },
          ],
          suppressedMessages: [],
          errorCount: 1,
          fatalErrorCount: 1,
          warningCount: 0,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
          usedDeprecatedRules: [],
        },
      ])
    ).toThrow(/Parsing error in apps\/web\/src\/domains\/billing\/broken.ts/);
  });

  it("ignores ordinary untagged ESLint messages without fatal errors", () => {
    expect(
      extractEslintExecutionFailure("/repo", [
        {
          filePath: "/repo/apps/web/src/domains/billing/console.ts",
          messages: [
            {
              ruleId: "no-console",
              severity: 2,
              message: "Unexpected console statement.",
              line: 1,
              column: 1,
            },
          ],
          suppressedMessages: [],
          errorCount: 1,
          fatalErrorCount: 0,
          warningCount: 0,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
          usedDeprecatedRules: [],
        },
      ])
    ).toBeUndefined();
  });
});

describe("doctor fixture integration", () => {
  it("reports cross-feature imports in fixture workspaces", () => {
    const fixture = createDoctorAtlasFixture({
      withViolation: "cross-feature-import",
      withApplicationTooling: false,
    });
    const context = createDoctorContext({ cwd: fixture.root });
    if (!context.project) {
      throw new Error("Expected resolved project contract in fixture.");
    }
    const policyTarget = resolveProductFeaturePolicyTarget(context.repoRoot, context.project);
    if (policyTarget.kind !== "application-source") {
      throw new Error("Expected default product feature root in fixture.");
    }
    const diagnostics = findCrossFeatureImportDiagnostics(context, policyTarget);

    expect(
      diagnostics.some(
        (diagnostic) => diagnostic.code === DoctorDiagnosticCode.BOUNDARY_CROSS_FEATURE_IMPORT
      )
    ).toBe(true);
  });
});
