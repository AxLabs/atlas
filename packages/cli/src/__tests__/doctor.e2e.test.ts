import { readFileSync } from "node:fs";
import path from "node:path";

import { ExitCode } from "../exit-codes";
import { DoctorDiagnosticCode } from "../doctor/diagnostics";
import {
  createDoctorAtlasFixture,
  createMissingContractFixture,
  snapshotFixtureTree,
} from "./helpers/doctor-fixture";
import { getRepoRoot, runAtlasCli } from "./helpers/run-cli";

describe("atlas doctor CLI", () => {
  const repoRoot = getRepoRoot();

  it("prints doctor in top-level help", () => {
    const result = runAtlasCli(["--help"], repoRoot);
    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(result.stdout).toContain("doctor");
  });

  it("passes on the healthy Atlas checkout", () => {
    const result = runAtlasCli(["doctor"], repoRoot);
    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(result.stdout).toContain("Atlas Doctor");
    expect(result.stdout).toContain("✓ Project contract");
    expect(result.stdout).toContain("Summary:");
  });

  it("emits deterministic JSON for a healthy checkout", () => {
    const first = runAtlasCli(["doctor", "--json"], repoRoot);
    const second = runAtlasCli(["doctor", "--json"], repoRoot);

    expect(first.exitCode).toBe(ExitCode.SUCCESS);
    expect(first.stderr).toBe("");

    const firstPayload = JSON.parse(first.stdout) as { ok: boolean; result: unknown };
    const secondPayload = JSON.parse(second.stdout) as { ok: boolean; result: unknown };

    expect(firstPayload.ok).toBe(true);
    expect(JSON.stringify(firstPayload.result)).toBe(JSON.stringify(secondPayload.result));
  });

  it("reports missing contract diagnostics without crashing", () => {
    const fixture = createMissingContractFixture();
    const result = runAtlasCli(["doctor", "--cwd", fixture.root, "--json"], fixture.root);
    const payload = JSON.parse(result.stdout) as {
      result: { status: string; diagnostics: { code: string }[] };
    };

    expect(result.exitCode).toBe(ExitCode.DOCTOR_FAILED);
    expect(payload.result.status).toBe("failed");
    expect(
      payload.result.diagnostics.some((d) => d.code === DoctorDiagnosticCode.CONTRACT_MISSING)
    ).toBe(true);
  });

  it("reports invalid contract JSON", () => {
    const fixture = createDoctorAtlasFixture({ invalidContract: true });
    const result = runAtlasCli(["doctor", "--cwd", fixture.root, "--json"], fixture.root);
    const payload = JSON.parse(result.stdout) as {
      result: { diagnostics: { code: string }[] };
    };

    expect(result.exitCode).toBe(ExitCode.DOCTOR_FAILED);
    expect(
      payload.result.diagnostics.some((d) => d.code === DoctorDiagnosticCode.CONTRACT_INVALID)
    ).toBe(true);
  });

  it("reports unsupported contract schema versions", () => {
    const fixture = createDoctorAtlasFixture({ unsupportedContract: true });
    const result = runAtlasCli(["doctor", "--cwd", fixture.root, "--json"], fixture.root);
    const payload = JSON.parse(result.stdout) as {
      result: { diagnostics: { code: string }[] };
    };

    expect(result.exitCode).toBe(ExitCode.DOCTOR_FAILED);
    expect(
      payload.result.diagnostics.some((d) => d.code === DoctorDiagnosticCode.CONTRACT_UNSUPPORTED)
    ).toBe(true);
  });

  it("skips OpenAPI check when capability is disabled", () => {
    const fixture = createDoctorAtlasFixture({ withContract: true, openApi: false });
    const result = runAtlasCli(["doctor", "--cwd", fixture.root, "--json"], fixture.root);
    const payload = JSON.parse(result.stdout) as {
      result: { checks: { id: string; status: string; skipReason?: string }[] };
    };

    const openApiCheck = payload.result.checks.find((check) => check.id === "generated-openapi");
    expect(openApiCheck?.status).toBe("skip");
    expect(openApiCheck?.skipReason).toContain("disabled");
  });

  it("does not mutate fixture files", () => {
    const fixture = createDoctorAtlasFixture({
      withViolation: "cross-feature-import",
      withApplicationTooling: true,
    });
    const before = snapshotFixtureTree(fixture.root);

    runAtlasCli(["doctor", "--cwd", fixture.root], fixture.root);

    expect(snapshotFixtureTree(fixture.root)).toEqual(before);
  });
});

describe("atlas doctor architecture diagnostics", () => {
  it("detects cross-feature imports in fixture workspaces", () => {
    const fixture = createDoctorAtlasFixture({
      withViolation: "cross-feature-import",
      withApplicationTooling: true,
    });
    const result = runAtlasCli(["doctor", "--cwd", fixture.root, "--json"], fixture.root);
    const payload = JSON.parse(result.stdout) as {
      result: { diagnostics: { code: string }[] };
    };

    expect(result.exitCode).toBe(ExitCode.DOCTOR_FAILED);
    expect(
      payload.result.diagnostics.some(
        (diagnostic) => diagnostic.code === DoctorDiagnosticCode.BOUNDARY_CROSS_FEATURE_IMPORT
      )
    ).toBe(true);
  });

  it("detects undeclared application dependencies", () => {
    const fixture = createDoctorAtlasFixture({
      withViolation: "undeclared-dependency",
      withApplicationTooling: false,
    });
    const result = runAtlasCli(["doctor", "--cwd", fixture.root, "--json"], fixture.root);
    const payload = JSON.parse(result.stdout) as {
      result: { diagnostics: { code: string }[] };
    };

    expect(result.exitCode).toBe(ExitCode.DOCTOR_FAILED);
    expect(
      payload.result.diagnostics.some(
        (diagnostic) => diagnostic.code === DoctorDiagnosticCode.DEPENDENCY_UNDECLARED
      )
    ).toBe(true);
  });

  it("agrees with ESLint on allowed public API fixtures", () => {
    const fixture = createDoctorAtlasFixture({ withApplicationTooling: true });
    const allowedPath = path.join(
      fixture.root,
      "apps/web/src/components/eslint-boundaries/allowed-public-api.tsx"
    );
    expect(readFileSync(allowedPath, "utf8")).toContain("@atlas/ui");

    const result = runAtlasCli(["doctor", "--cwd", fixture.root, "--json"], fixture.root);
    const payload = JSON.parse(result.stdout) as {
      result: { diagnostics: { path?: string }[] };
    };

    expect(
      payload.result.diagnostics.some((diagnostic) =>
        diagnostic.path?.includes("allowed-public-api")
      )
    ).toBe(false);
  });
});
