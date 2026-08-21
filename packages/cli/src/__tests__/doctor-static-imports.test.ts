import { packageRootFromSpecifier, extractStaticModuleSpecifiers } from "../doctor/static-imports";
import { isWorkspaceRootIncluded, parsePnpmWorkspaceFile } from "../doctor/workspace-membership";
import {
  deriveProductFeatureImportPrefix,
  resolveImportedProductFeatureName,
} from "../doctor/feature-alias";
import { DOCTOR_DIAGNOSTIC_DEFINITIONS, DoctorDiagnosticCode } from "../doctor/diagnostics";
import { doctorReportHasErrors, runDoctorChecks } from "../doctor/runner";
import { createDoctorContext } from "../doctor/context";
import { DEFAULT_ATLAS_PROJECT_CONTRACT } from "@atlas/project";

describe("packageRootFromSpecifier", () => {
  it.each([
    ["next/navigation", "next"],
    ["next/headers", "next"],
    ["react/jsx-runtime", "react"],
    ["lodash/get", "lodash"],
    ["@tanstack/react-query", "@tanstack/react-query"],
    ["@tanstack/react-query/devtools", "@tanstack/react-query"],
    ["@atlas/ui", "@atlas/ui"],
    ["@atlas/ui/some-subpath", "@atlas/ui"],
  ])("normalizes %s to %s", (specifier, expected) => {
    expect(packageRootFromSpecifier(specifier)).toBe(expected);
  });

  it.each(["node:path", "@/lib/api", "./thing", "../relative"])(
    "ignores non-package specifier %s",
    (specifier) => {
      expect(packageRootFromSpecifier(specifier)).toBeUndefined();
    }
  );
});

describe("extractStaticModuleSpecifiers", () => {
  it("ignores commented-out imports", () => {
    const specifiers = extractStaticModuleSpecifiers(
      "example.ts",
      `// import { z } from "fake-package";\nexport const value = 1;\n`
    );

    expect(specifiers).toHaveLength(0);
  });

  it("ignores import-like strings in string literals", () => {
    const specifiers = extractStaticModuleSpecifiers(
      "example.ts",
      `const text = 'import foo from "fake-package"';\n`
    );

    expect(specifiers).toHaveLength(0);
  });

  it("extracts real imports with line and column metadata", () => {
    const specifiers = extractStaticModuleSpecifiers(
      "example.ts",
      `import { redirect } from "next/navigation";\n`
    );

    expect(specifiers).toEqual([
      {
        specifier: "next/navigation",
        line: 1,
        column: 26,
      },
    ]);
  });
});

describe("workspace membership", () => {
  it("matches standard Atlas workspace globs", () => {
    const patterns = parsePnpmWorkspaceFile('packages:\n  - "apps/*"\n  - "packages/*"\n').patterns;

    expect(isWorkspaceRootIncluded(patterns, "apps/web")).toBe(true);
    expect(isWorkspaceRootIncluded(patterns, "packages/ui")).toBe(true);
  });

  it("fails when only apps/* is configured", () => {
    const patterns = parsePnpmWorkspaceFile('packages:\n  - "apps/*"\n').patterns;
    expect(isWorkspaceRootIncluded(patterns, "packages/ui")).toBe(false);
  });

  it("supports explicit package roots", () => {
    const patterns = parsePnpmWorkspaceFile(
      'packages:\n  - "apps/web"\n  - "packages/ui"\n'
    ).patterns;

    expect(isWorkspaceRootIncluded(patterns, "apps/web")).toBe(true);
    expect(isWorkspaceRootIncluded(patterns, "packages/ui")).toBe(true);
  });

  it("does not pass on comment-only package mentions", () => {
    const patterns = parsePnpmWorkspaceFile(
      'packages:\n  - "apps/*"\n  # packages/ui intentionally omitted\n'
    ).patterns;

    expect(isWorkspaceRootIncluded(patterns, "packages/ui")).toBe(false);
  });

  it("respects negated workspace patterns", () => {
    const patterns = parsePnpmWorkspaceFile(
      'packages:\n  - "apps/*"\n  - "!apps/web"\n  - "packages/*"\n'
    ).patterns;

    expect(isWorkspaceRootIncluded(patterns, "apps/web")).toBe(false);
    expect(isWorkspaceRootIncluded(patterns, "packages/ui")).toBe(true);
  });
});

describe("contract-driven feature alias", () => {
  it("derives custom product feature import prefixes", () => {
    const project = {
      ...DEFAULT_ATLAS_PROJECT_CONTRACT,
      schemaVersion: 1 as const,
      application: { root: "apps/web" },
      features: {
        product: "apps/web/src/domains",
        reference: "apps/web/src/domains/reference",
        examples: "apps/web/src/domains/examples",
      },
    };

    expect(deriveProductFeatureImportPrefix(project)).toBe("@/domains/");
    expect(
      resolveImportedProductFeatureName("@/domains/users", ["users", "billing"], "@/domains/")
    ).toBe("users");
  });
});

describe("doctor diagnostic registry", () => {
  it("registers every emitted diagnostic code", () => {
    for (const code of Object.values(DoctorDiagnosticCode)) {
      expect(DOCTOR_DIAGNOSTIC_DEFINITIONS[code]).toBeDefined();
    }
  });
});

describe("doctor report invariants", () => {
  it("treats failed checks as report errors even without ordinary diagnostics", async () => {
    const context = createDoctorContext({ cwd: process.cwd() });
    const report = await runDoctorChecks({
      ...context,
      project: context.project,
      contractError: undefined,
      checkoutAtlasVersion: context.checkoutAtlasVersion ?? "0.1.0",
      checkoutVersionError: undefined,
    });

    const failedReport = {
      ...report,
      checks: report.checks.map((check) =>
        check.id === "architecture-boundaries"
          ? { ...check, status: "fail" as const, diagnostics: [] }
          : check
      ),
      summary: {
        ...report.summary,
        checksFailed: 1,
        diagnosticErrors: 0,
      },
    };

    expect(doctorReportHasErrors(failedReport)).toBe(true);
  });
});
