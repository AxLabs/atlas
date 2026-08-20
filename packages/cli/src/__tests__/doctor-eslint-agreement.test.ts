import path from "node:path";
import { spawnSync } from "node:child_process";

import { DoctorDiagnosticCode } from "../doctor/diagnostics";
import { mapEslintMessageToDiagnostic } from "../doctor/map-eslint";
import { getRepoRoot } from "./helpers/run-cli";

describe("doctor eslint agreement", () => {
  const repoRoot = getRepoRoot();
  const webRoot = path.join(repoRoot, "apps/web");

  function lintBoundaryFixture(...segments: string[]) {
    const filePath = path.join(webRoot, "src", ...segments);
    const eslint = spawnSync(
      "pnpm",
      [
        "exec",
        "eslint",
        "--no-ignore",
        "--config",
        path.join(webRoot, "eslint.config.mjs"),
        "--format",
        "json",
        filePath,
      ],
      {
        cwd: webRoot,
        encoding: "utf8",
      }
    );

    const payload = JSON.parse(eslint.stdout || "[]") as {
      filePath: string;
      messages: {
        ruleId: string | null;
        message: string;
        line: number;
        column: number;
      }[];
    }[];

    return payload[0];
  }

  it.each([
    [
      "components/eslint-boundaries/prohibited-package-source.ts",
      DoctorDiagnosticCode.BOUNDARY_PRIVATE_IMPORT,
    ],
    [
      "components/eslint-boundaries/prohibited-process-env.ts",
      DoctorDiagnosticCode.BOUNDARY_DIRECT_ENV,
    ],
    ["components/eslint-boundaries/prohibited-fetch.ts", DoctorDiagnosticCode.BOUNDARY_RAW_NETWORK],
    [
      "features/eslint-boundaries/prohibited-reference-import.ts",
      DoctorDiagnosticCode.BOUNDARY_REFERENCE_IMPORT,
    ],
  ] as const)("maps prohibited fixture %s to %s", (relativePath, code) => {
    const result = lintBoundaryFixture(...relativePath.split("/"));
    const message = result?.messages[0];
    if (!message) {
      throw new Error(`Expected ESLint violation for ${relativePath}`);
    }

    const diagnostic = mapEslintMessageToDiagnostic(repoRoot, webRoot, {
      ruleId: message.ruleId,
      message: message.message,
      line: message.line,
      column: message.column,
      filePath: result.filePath,
    });

    expect(diagnostic?.code).toBe(code);
  });

  it("does not flag allowed public API fixtures", () => {
    const result = lintBoundaryFixture("components/eslint-boundaries/allowed-public-api.tsx");
    const architectureMessages =
      result?.messages.filter((message) =>
        mapEslintMessageToDiagnostic(repoRoot, webRoot, {
          ruleId: message.ruleId,
          message: message.message,
          line: message.line,
          column: message.column,
          filePath: result.filePath,
        })
      ) ?? [];

    expect(architectureMessages).toHaveLength(0);
  });
});
