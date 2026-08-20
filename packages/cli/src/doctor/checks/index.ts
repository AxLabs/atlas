import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { findCrossFeatureImportDiagnostics } from "../cross-feature-imports";
import { findUndeclaredDependencyDiagnostics } from "../dependency-imports";
import { createDiagnostic, DoctorDiagnosticCode } from "../diagnostics";
import { dedupeDiagnostics, mapContractErrorToDiagnostics } from "../map-contract-error";
import { mapEslintMessageToDiagnostic } from "../map-eslint";
import { compareOpenApiFreshness } from "../openapi-freshness";
import { joinRepoAbsolutePath } from "../paths";

import type { DoctorContext } from "../context";
import type { DoctorCheckResult, DoctorDiagnostic } from "../types";
import type { ESLint } from "eslint";

export function runProjectContractCheck(context: DoctorContext): DoctorCheckResult {
  const base = {
    id: "project-contract",
    title: "Project contract",
    rationale:
      "Atlas tooling cannot reason reliably about architecture without a valid atlas.config.json contract resolved through @atlas/project.",
  };

  if (context.contractError) {
    return {
      ...base,
      status: "fail",
      diagnostics: mapContractErrorToDiagnostics(context.contractError),
    };
  }

  return {
    ...base,
    status: "pass",
    diagnostics: [],
  };
}

export function runWorkspaceStructureCheck(context: DoctorContext): DoctorCheckResult {
  const base = {
    id: "workspace-structure",
    title: "Workspace structure",
    rationale:
      "Configured Atlas workspace roots must exist and be discoverable by pnpm for reliable package boundaries.",
  };

  if (!context.project) {
    return {
      ...base,
      status: "skip",
      diagnostics: [],
      skipReason: "Project contract is invalid or missing.",
    };
  }

  const diagnostics = [];

  const applicationManifest = joinRepoAbsolutePath(
    context.repoRoot,
    path.posix.join(context.project.application.root, "package.json")
  );
  if (!existsSync(applicationManifest)) {
    diagnostics.push(
      createDiagnostic(
        DoctorDiagnosticCode.WORKSPACE_PACKAGE_MANIFEST_MISSING,
        `Missing application package manifest at ${context.project.application.root}/package.json.`,
        { path: path.posix.join(context.project.application.root, "package.json") }
      )
    );
  }

  const uiManifest = joinRepoAbsolutePath(
    context.repoRoot,
    path.posix.join(context.project.ui.path, "package.json")
  );
  if (!existsSync(uiManifest)) {
    diagnostics.push(
      createDiagnostic(
        DoctorDiagnosticCode.WORKSPACE_PACKAGE_MANIFEST_MISSING,
        `Missing UI package manifest at ${context.project.ui.path}/package.json.`,
        { path: path.posix.join(context.project.ui.path, "package.json") }
      )
    );
  }

  const workspaceFile = joinRepoAbsolutePath(context.repoRoot, "pnpm-workspace.yaml");
  if (existsSync(workspaceFile)) {
    const workspaceContents = readFileSync(workspaceFile, "utf8");
    for (const relativeRoot of [context.project.application.root, context.project.ui.path]) {
      if (!isWorkspaceIncluded(workspaceContents, relativeRoot)) {
        diagnostics.push(
          createDiagnostic(
            DoctorDiagnosticCode.WORKSPACE_NOT_INCLUDED,
            `Configured workspace root "${relativeRoot}" is not included by pnpm-workspace.yaml.`,
            { path: "pnpm-workspace.yaml" }
          )
        );
      }
    }
  }

  const uniqueDiagnostics = dedupeDiagnostics(diagnostics);
  return {
    ...base,
    status: uniqueDiagnostics.length > 0 ? "fail" : "pass",
    diagnostics: uniqueDiagnostics,
  };
}

function isWorkspaceIncluded(workspaceContents: string, relativeRoot: string): boolean {
  const normalized = relativeRoot.replace(/\\/g, "/");
  if (normalized.startsWith("apps/") && workspaceContents.includes("apps/*")) {
    return true;
  }

  if (normalized.startsWith("packages/") && workspaceContents.includes("packages/*")) {
    return true;
  }

  return workspaceContents.includes(normalized);
}

export async function runArchitectureBoundariesCheck(
  context: DoctorContext
): Promise<DoctorCheckResult> {
  const base = {
    id: "architecture-boundaries",
    title: "Architecture boundaries",
    rationale:
      "Source bypassing owned boundaries makes migrations, hoisting assumptions, and agent behavior less predictable.",
  };

  if (!context.project) {
    return {
      ...base,
      status: "skip",
      diagnostics: [],
      skipReason: "Project contract is invalid or missing.",
    };
  }

  const applicationRoot = path.join(context.repoRoot, context.project.application.root);
  const eslintConfigPath = path.join(applicationRoot, "eslint.config.mjs");
  if (!existsSync(eslintConfigPath)) {
    return {
      ...base,
      status: "skip",
      diagnostics: [],
      skipReason: "Application ESLint config was not found.",
    };
  }

  let eslintDiagnostics: DoctorDiagnostic[] = [];
  try {
    eslintDiagnostics = await collectEslintArchitectureDiagnostics(context, applicationRoot);
  } catch {
    eslintDiagnostics = [];
  }

  const crossFeatureDiagnostics = findCrossFeatureImportDiagnostics(context);
  const diagnostics = dedupeDiagnostics([...eslintDiagnostics, ...crossFeatureDiagnostics]);

  return {
    ...base,
    status: diagnostics.some((diagnostic: DoctorDiagnostic) => diagnostic.severity === "error")
      ? "fail"
      : "pass",
    diagnostics,
  };
}

async function collectEslintArchitectureDiagnostics(
  context: DoctorContext,
  applicationRoot: string
): Promise<DoctorDiagnostic[]> {
  const eslint = loadEslintModule(applicationRoot);
  const eslintConfigPath = path.join(applicationRoot, "eslint.config.mjs");
  const eslintInstance = new eslint.ESLint({
    cwd: applicationRoot,
    overrideConfigFile: eslintConfigPath,
  });

  const targetPatterns = [
    "src/app",
    "src/components",
    "src/features",
    "src/providers",
    "src/hooks",
    "src/lib",
  ];
  const existingTargets = targetPatterns
    .map((pattern) => path.join(applicationRoot, pattern))
    .filter((target) => existsSync(target));

  if (existingTargets.length === 0) {
    return [];
  }

  const results = await eslintInstance.lintFiles(existingTargets);
  const diagnostics = [];

  for (const result of results) {
    for (const message of result.messages) {
      const diagnostic = mapEslintMessageToDiagnostic(context.repoRoot, applicationRoot, {
        ...message,
        filePath: result.filePath,
      });
      if (diagnostic) {
        diagnostics.push(diagnostic);
      }
    }
  }

  return dedupeDiagnostics(diagnostics);
}

function loadEslintModule(applicationRoot: string): { ESLint: typeof ESLint } {
  const requireFromApp = createRequire(path.join(applicationRoot, "package.json"));
  try {
    return requireFromApp("eslint") as { ESLint: typeof ESLint };
  } catch {
    const requireFromCli = createRequire(pathToFileURL(__filename).href);
    return requireFromCli("eslint") as { ESLint: typeof ESLint };
  }
}

export function runDependencyDeclarationsCheck(context: DoctorContext): DoctorCheckResult {
  const base = {
    id: "dependency-declarations",
    title: "Dependency declarations",
    rationale:
      "pnpm workspace hoisting can hide undeclared dependency reliance that regresses when package graphs change.",
  };

  if (!context.project) {
    return {
      ...base,
      status: "skip",
      diagnostics: [],
      skipReason: "Project contract is invalid or missing.",
    };
  }

  const diagnostics = findUndeclaredDependencyDiagnostics(context);

  return {
    ...base,
    status: diagnostics.length > 0 ? "fail" : "pass",
    diagnostics,
  };
}

export async function runGeneratedOpenApiCheck(context: DoctorContext): Promise<DoctorCheckResult> {
  const base = {
    id: "generated-openapi",
    title: "Generated OpenAPI",
    rationale:
      "When OpenAPI is enabled, generated client artifacts must match the canonical spec deterministically.",
  };

  if (!context.project) {
    return {
      ...base,
      status: "skip",
      diagnostics: [],
      skipReason: "Project contract is invalid or missing.",
    };
  }

  if (!context.project.capabilities.openApi) {
    return {
      ...base,
      status: "skip",
      diagnostics: [],
      skipReason: "OpenAPI capability is disabled for this Atlas project.",
    };
  }

  const comparison = await compareOpenApiFreshness(context);
  if (comparison.skipReason) {
    return {
      ...base,
      status: "skip",
      diagnostics: [],
      skipReason: comparison.skipReason,
    };
  }

  return {
    ...base,
    status: comparison.diagnostics.length > 0 ? "fail" : "pass",
    diagnostics: comparison.diagnostics,
  };
}

export function runAtlasVersionCheck(context: DoctorContext): DoctorCheckResult {
  const base = {
    id: "atlas-version",
    title: "Atlas version",
    rationale:
      "The installed Atlas CLI snapshot should match the checkout version to avoid tooling/project drift during future migrations.",
  };

  if (context.atlasVersion === context.checkoutAtlasVersion) {
    return {
      ...base,
      status: "pass",
      diagnostics: [],
    };
  }

  return {
    ...base,
    status: "warn",
    diagnostics: [
      createDiagnostic(
        DoctorDiagnosticCode.VERSION_MISMATCH,
        `Installed Atlas CLI version ${context.atlasVersion} differs from checkout version ${context.checkoutAtlasVersion}.`,
        { path: "package.json" }
      ),
    ],
  };
}
