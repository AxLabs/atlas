import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { createDiagnostic, DoctorDiagnosticCode } from "./diagnostics";
import { joinRepoAbsolutePath } from "./paths";

import type { DoctorContext } from "./context";
import type { DoctorDiagnostic } from "./types";

interface OpenApiFreshnessResult {
  diagnostics: DoctorDiagnostic[];
  skipReason?: string;
}

export async function compareOpenApiFreshness(
  context: DoctorContext
): Promise<OpenApiFreshnessResult> {
  if (!context.project?.capabilities.openApi) {
    return { diagnostics: [] };
  }

  const specPath = joinRepoAbsolutePath(context.repoRoot, context.project.generated.openApi.spec);
  const schemaPath = joinRepoAbsolutePath(
    context.repoRoot,
    context.project.generated.openApi.schema
  );
  const applicationRoot = joinRepoAbsolutePath(context.repoRoot, context.project.application.root);

  if (!existsSync(specPath) || !existsSync(schemaPath)) {
    return { diagnostics: [] };
  }

  const tempDir = mkdtempSync(path.join(os.tmpdir(), "atlas-doctor-openapi-"));
  const generatedPath = path.join(tempDir, "schema.ts");

  try {
    const openapiTypescriptBin = resolveOpenApiTypescriptBin(applicationRoot);
    if (!openapiTypescriptBin) {
      return {
        diagnostics: [],
        skipReason: "OpenAPI generator tooling is unavailable in this checkout.",
      };
    }

    execFileSync(
      process.execPath,
      [openapiTypescriptBin, specPath, "-o", generatedPath, "--empty-objects-unknown"],
      {
        cwd: applicationRoot,
        stdio: "pipe",
      }
    );

    const expected = readFileSync(schemaPath, "utf8");
    const actual = readFileSync(generatedPath, "utf8");

    if (expected === actual) {
      return { diagnostics: [] };
    }

    return {
      diagnostics: [
        createDiagnostic(
          DoctorDiagnosticCode.GENERATED_OPENAPI_STALE,
          `Generated OpenAPI client at ${context.project.generated.openApi.schema} is stale relative to ${context.project.generated.openApi.spec}.`,
          { path: context.project.generated.openApi.schema }
        ),
      ],
    };
  } catch {
    return {
      diagnostics: [],
      skipReason: "Unable to compare OpenAPI artifacts deterministically in this checkout.",
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function resolveOpenApiTypescriptBin(applicationRoot: string): string | undefined {
  try {
    const requireFromApp = createRequire(path.join(applicationRoot, "package.json"));
    const packageJsonPath = requireFromApp.resolve("openapi-typescript/package.json");
    return path.join(path.dirname(packageJsonPath), "bin/cli.js");
  } catch {
    return undefined;
  }
}
