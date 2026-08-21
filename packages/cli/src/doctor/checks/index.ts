import { existsSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { DoctorCheckExecutionError } from "../check-execution-error";
import { findCrossFeatureImportDiagnostics } from "../cross-feature-imports";
import { findUndeclaredDependencyDiagnostics } from "../dependency-imports";
import { createDiagnostic, DoctorDiagnosticCode } from "../diagnostics";
import {
  applicationSourceRoot,
  deriveAppAliasPrefix,
  deriveProductFeatureImportPrefix,
} from "../feature-alias";
import { dedupeDiagnostics, mapContractErrorToDiagnostics } from "../map-contract-error";
import { mapEslintMessageToDiagnostic } from "../map-eslint";
import { compareOpenApiFreshness } from "../openapi-freshness";
import { joinRepoAbsolutePath } from "../paths";
import { isWorkspaceRootIncluded, readPnpmWorkspacePatterns } from "../workspace-membership";

import type { DoctorContext } from "../context";
import type { DoctorCheckResult, DoctorDiagnostic } from "../types";
import type { ESLint } from "eslint";

const DEFAULT_PRODUCT_FEATURE_GLOB = "src/features";

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

  const diagnostics: DoctorDiagnostic[] = [];

  if (context.checkoutVersionError) {
    diagnostics.push(
      createDiagnostic(
        DoctorDiagnosticCode.ROOT_PACKAGE_METADATA_INVALID,
        context.checkoutVersionError,
        { path: "package.json" }
      )
    );
  }

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
  if (!existsSync(workspaceFile)) {
    diagnostics.push(
      createDiagnostic(
        DoctorDiagnosticCode.WORKSPACE_CONFIG_MISSING,
        "Missing pnpm-workspace.yaml at repository root.",
        { path: "pnpm-workspace.yaml" }
      )
    );
  } else {
    const { patterns } = readPnpmWorkspacePatterns(workspaceFile);
    for (const relativeRoot of [context.project.application.root, context.project.ui.path]) {
      if (!isWorkspaceRootIncluded(patterns, relativeRoot)) {
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
      status: "fail",
      diagnostics: [
        createDiagnostic(
          DoctorDiagnosticCode.ARCHITECTURE_POLICY_MISSING,
          `Missing required application ESLint config at ${context.project.application.root}/eslint.config.mjs.`,
          { path: path.posix.join(context.project.application.root, "eslint.config.mjs") }
        ),
      ],
    };
  }

  const crossFeatureDiagnostics = findCrossFeatureImportDiagnostics(context);

  try {
    const eslintDiagnostics = await collectEslintArchitectureDiagnostics(context, applicationRoot);
    const diagnostics = dedupeDiagnostics([...eslintDiagnostics, ...crossFeatureDiagnostics]);

    return {
      ...base,
      status: diagnostics.some((diagnostic: DoctorDiagnostic) => diagnostic.severity === "error")
        ? "fail"
        : "pass",
      diagnostics,
    };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Architecture boundary ESLint execution failed.";
    throw new DoctorCheckExecutionError(reason, crossFeatureDiagnostics);
  }
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
  const lintTargets = collectArchitectureLintFiles(applicationRoot, targetPatterns);

  if (context.project) {
    const productRootAbsolute = joinRepoAbsolutePath(
      context.repoRoot,
      context.project.features.product
    );
    const relativeFromApp = path
      .relative(applicationRoot, productRootAbsolute)
      .split(path.sep)
      .join("/");

    if (
      existsSync(productRootAbsolute) &&
      relativeFromApp !== DEFAULT_PRODUCT_FEATURE_GLOB &&
      !relativeFromApp.startsWith("..")
    ) {
      lintTargets.push(
        ...collectArchitectureLintFiles(productRootAbsolute, ["."], productRootAbsolute)
      );
    }
  }

  const uniqueLintTargets = [...new Set(lintTargets)].sort();

  if (uniqueLintTargets.length === 0) {
    return [];
  }

  const results = await eslintInstance.lintFiles(uniqueLintTargets);
  const diagnostics: DoctorDiagnostic[] = [];

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

  const customFeatureDiagnostics = await lintCustomProductFeatureRoot(context, applicationRoot);
  return dedupeDiagnostics([...diagnostics, ...customFeatureDiagnostics]);
}

const ARCHITECTURE_LINT_EXTENSIONS = /\.(ts|tsx|js|jsx|mts|cts)$/;
const ARCHITECTURE_LINT_IGNORED_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "coverage",
  ".turbo",
  "__tests__",
]);

function collectArchitectureLintFiles(
  root: string,
  relativeRoots: string[],
  walkRoot = root
): string[] {
  const files: string[] = [];

  for (const relativeRoot of relativeRoots) {
    const absoluteRoot = path.resolve(walkRoot, relativeRoot);
    if (!existsSync(absoluteRoot)) {
      continue;
    }

    walkArchitectureLintDirectory(absoluteRoot, files);
  }

  return files;
}

function walkArchitectureLintDirectory(directory: string, files: string[]): void {
  for (const entry of readdirSync(directory)) {
    if (
      entry.endsWith(".test.ts") ||
      entry.endsWith(".test.tsx") ||
      entry.endsWith(".spec.ts") ||
      entry.endsWith(".spec.tsx")
    ) {
      continue;
    }

    const absolutePath = path.join(directory, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      if (ARCHITECTURE_LINT_IGNORED_DIRS.has(entry)) {
        continue;
      }
      walkArchitectureLintDirectory(absolutePath, files);
      continue;
    }

    if (ARCHITECTURE_LINT_EXTENSIONS.test(entry)) {
      files.push(absolutePath);
    }
  }
}

async function lintCustomProductFeatureRoot(
  context: DoctorContext,
  applicationRoot: string
): Promise<DoctorDiagnostic[]> {
  if (!context.project) {
    return [];
  }

  const productRootAbsolute = joinRepoAbsolutePath(
    context.repoRoot,
    context.project.features.product
  );
  if (!existsSync(productRootAbsolute)) {
    return [];
  }

  const relativeFromApp = path
    .relative(applicationRoot, productRootAbsolute)
    .split(path.sep)
    .join("/");

  if (relativeFromApp === DEFAULT_PRODUCT_FEATURE_GLOB || relativeFromApp.startsWith("..")) {
    return [];
  }

  const productFiles = collectArchitectureLintFiles(
    productRootAbsolute,
    ["."],
    productRootAbsolute
  );
  if (productFiles.length === 0) {
    return [];
  }

  const policyModulePath = path.join(applicationRoot, "architecture-policy.mjs");
  if (!existsSync(policyModulePath)) {
    throw new Error(
      `Missing architecture policy module at ${context.project.application.root}/architecture-policy.mjs.`
    );
  }

  const policyModule = (await import(pathToFileURL(policyModulePath).href)) as {
    PRODUCT_FEATURE_IMPORT_RESTRICTIONS: unknown;
  };

  const referenceAlias = deriveAppAliasPrefix(context.project, context.project.features.reference);
  const examplesAlias = deriveAppAliasPrefix(context.project, context.project.features.examples);
  const productRestrictions = buildCustomProductFeatureRestrictions(
    policyModule.PRODUCT_FEATURE_IMPORT_RESTRICTIONS,
    referenceAlias,
    examplesAlias
  );

  const eslint = loadEslintModule(applicationRoot);
  const eslintConfigPath = path.join(applicationRoot, "eslint.config.mjs");
  const eslintInstance = new eslint.ESLint({
    cwd: applicationRoot,
    overrideConfigFile: eslintConfigPath,
    overrideConfig: [
      {
        files: [`${relativeFromApp}/**/*.{ts,tsx}`],
        ignores: [
          `${relativeFromApp}/reference/**`,
          `${relativeFromApp}/examples/**`,
          "**/__tests__/**",
          "**/*.test.{ts,tsx}",
          "**/*.spec.{ts,tsx}",
        ],
        rules: {
          "no-restricted-imports": ["error", productRestrictions],
        },
      },
    ],
  });

  const results = await eslintInstance.lintFiles(productFiles);
  const diagnostics: DoctorDiagnostic[] = [];

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

  return diagnostics;
}

function buildCustomProductFeatureRestrictions(
  baseRestrictions: unknown,
  referenceAlias?: string,
  examplesAlias?: string
): Record<string, unknown> {
  const restrictions = structuredClone(baseRestrictions) as {
    paths?: unknown[];
    patterns?: { group: string[]; message: string }[];
  };

  if (!referenceAlias && !examplesAlias) {
    return restrictions;
  }

  const dynamicPatterns = [
    ...(referenceAlias ? [`${referenceAlias.replace(/\/$/, "")}/**`] : []),
    ...(examplesAlias ? [`${examplesAlias.replace(/\/$/, "")}/**`] : []),
  ];

  const referencePattern = restrictions.patterns?.find((pattern) =>
    pattern.group.some((entry) => entry.includes("reference"))
  );

  if (referencePattern) {
    referencePattern.group = [...dynamicPatterns, ...referencePattern.group];
  } else if (dynamicPatterns.length > 0) {
    restrictions.patterns = [
      ...(restrictions.patterns ?? []),
      {
        group: dynamicPatterns,
        message:
          "Product features must not import reference or example modules. Copy the pattern or extract shared logic to src/lib/.",
      },
    ];
  }

  return restrictions;
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

  if (context.checkoutVersionError || !context.checkoutAtlasVersion) {
    return {
      ...base,
      status: "fail",
      diagnostics: [
        createDiagnostic(
          DoctorDiagnosticCode.ROOT_PACKAGE_METADATA_INVALID,
          context.checkoutVersionError ?? "Unable to read checkout version from root package.json.",
          { path: "package.json" }
        ),
      ],
    };
  }

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

export { applicationSourceRoot, deriveProductFeatureImportPrefix };
