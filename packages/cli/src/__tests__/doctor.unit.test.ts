import { mapContractErrorToDiagnostics } from "../doctor/map-contract-error";
import { mapEslintMessageToDiagnostic, sortDiagnostics } from "../doctor/map-eslint";
import { DoctorDiagnosticCode } from "../doctor/diagnostics";
import { runDoctor } from "../doctor";
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
});

describe("doctor fixture integration", () => {
  it("reports cross-feature imports in fixture workspaces", async () => {
    const fixture = createDoctorAtlasFixture({
      withViolation: "cross-feature-import",
      withApplicationTooling: true,
    });
    const report = await runDoctor({ cwd: fixture.root });

    expect(report.checks.find((check) => check.id === "project-contract")?.status).toBe("pass");
    expect(
      report.diagnostics.some(
        (diagnostic) => diagnostic.code === DoctorDiagnosticCode.BOUNDARY_CROSS_FEATURE_IMPORT
      )
    ).toBe(true);
  });
});
