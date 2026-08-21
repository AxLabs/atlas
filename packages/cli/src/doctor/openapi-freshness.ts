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

    try {
      execFileSync(
        process.execPath,
        [openapiTypescriptBin, specPath, "-o", generatedPath, "--empty-objects-unknown"],
        {
          cwd: applicationRoot,
          stdio: "pipe",
        }
      );
    } catch (error) {
      let reason = "OpenAPI generation failed.";
      if (error instanceof Error && "stderr" in error) {
        const stderr = (error as NodeJS.ErrnoException & { stderr?: Buffer }).stderr;
        const stderrText = stderr ? String(stderr).trim() : error.message;
        reason = stderrText.split("\n")[0] ?? error.message;
      } else if (error instanceof Error) {
        reason = error.message;
      }

      return {
        diagnostics: [
          createDiagnostic(
            DoctorDiagnosticCode.GENERATED_OPENAPI_INVALID,
            `OpenAPI generation failed for ${context.project.generated.openApi.spec}: ${reason}`,
            { path: context.project.generated.openApi.spec }
          ),
        ],
      };
    }

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
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function resolveOpenApiTypescriptBin(applicationRoot: string): string | undefined {
  const packageJsonPath = path.join(applicationRoot, "package.json");
  if (!existsSync(packageJsonPath)) {
    return undefined;
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };

  const declaredDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies,
  };

  if (!("openapi-typescript" in declaredDependencies)) {
    return undefined;
  }

  try {
    const requireFromApp = createRequire(packageJsonPath);
    const resolvedPackageJson = requireFromApp.resolve("openapi-typescript/package.json");
    return path.join(path.dirname(resolvedPackageJson), "bin/cli.js");
  } catch {
    return undefined;
  }
}
