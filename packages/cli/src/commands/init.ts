import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  ATLAS_CONTRACT_FILENAME,
  DEFAULT_ATLAS_PROJECT_CONTRACT,
  joinRepoPath,
  LATEST_SCHEMA_VERSION,
  type RawAtlasProjectContract,
} from "@atlas/project";

import { CliError, CliErrorCode } from "../errors/cli-error";
import { validatePrerequisites } from "../init/prerequisites";
import { findAtlasRepoRoot, findStructuralAtlasRoot } from "../project/find-root";

import type { CommandResult, PlannedAction } from "../types/result";

export type ReferencePolicy = "keep" | "remove";
export type EnvPolicy = "skip" | "copy";

export interface InitOptions {
  cwd?: string;
  dryRun?: boolean;
  reference: ReferencePolicy;
  env: EnvPolicy;
}

const REQUIRED_STRUCTURE = [
  DEFAULT_ATLAS_PROJECT_CONTRACT.application.root,
  DEFAULT_ATLAS_PROJECT_CONTRACT.features.product,
  DEFAULT_ATLAS_PROJECT_CONTRACT.ui.path,
];

const REFERENCE_PATHS = [
  DEFAULT_ATLAS_PROJECT_CONTRACT.features.reference,
  DEFAULT_ATLAS_PROJECT_CONTRACT.features.examples,
  DEFAULT_ATLAS_PROJECT_CONTRACT.reference.components,
  DEFAULT_ATLAS_PROJECT_CONTRACT.reference.routes,
];

function readRepoVersion(repoRoot: string): string {
  const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
    version?: string;
  };

  return packageJson.version ?? "unknown";
}

function validateCompatibleStructure(repoRoot: string): void {
  const missing = REQUIRED_STRUCTURE.filter((relativePath) => {
    const absolutePath = joinRepoPath(repoRoot, relativePath);
    return !existsSync(absolutePath);
  });

  if (missing.length > 0) {
    throw new CliError(
      CliErrorCode.BOOTSTRAP_CONFLICT,
      "Checkout does not look like a compatible Atlas project.",
      {
        details: missing.map((relativePath) => `Missing required path: ${relativePath}`),
      }
    );
  }
}

function planContractCreation(repoRoot: string): PlannedAction[] {
  const contractPath = path.join(repoRoot, ATLAS_CONTRACT_FILENAME);
  if (existsSync(contractPath)) {
    return [
      {
        kind: "skip",
        path: ATLAS_CONTRACT_FILENAME,
        reason: "Atlas contract already exists",
      },
    ];
  }

  return [
    {
      kind: "create",
      path: ATLAS_CONTRACT_FILENAME,
      reason: "Create minimal Atlas project contract",
    },
  ];
}

function planReferenceActions(repoRoot: string, reference: ReferencePolicy): PlannedAction[] {
  if (reference === "keep") {
    return REFERENCE_PATHS.map((relativePath) => ({
      kind: "skip" as const,
      path: relativePath,
      reason: "Reference content retained (--reference keep)",
    }));
  }

  return REFERENCE_PATHS.map((relativePath) => {
    const absolutePath = joinRepoPath(repoRoot, relativePath);
    if (!existsSync(absolutePath)) {
      return {
        kind: "skip" as const,
        path: relativePath,
        reason: "Reference path already absent",
      };
    }

    return {
      kind: "remove" as const,
      path: relativePath,
      reason: "Remove reference content (--reference remove)",
    };
  });
}

function planEnvActions(repoRoot: string, env: EnvPolicy): PlannedAction[] {
  const targetRelative = path.posix.join(
    DEFAULT_ATLAS_PROJECT_CONTRACT.application.root,
    ".env.local"
  );
  const exampleRelative = path.posix.join(
    DEFAULT_ATLAS_PROJECT_CONTRACT.application.root,
    ".env.example"
  );
  const examplePath = joinRepoPath(
    repoRoot,
    path.posix.join(DEFAULT_ATLAS_PROJECT_CONTRACT.application.root, ".env.example")
  );
  const targetPath = joinRepoPath(repoRoot, targetRelative);

  if (env === "skip") {
    return [
      {
        kind: "skip",
        path: targetRelative,
        reason: "Environment setup skipped (--env skip)",
      },
    ];
  }

  if (!existsSync(examplePath)) {
    return [
      {
        kind: "skip",
        path: targetRelative,
        reason: `${exampleRelative} not found`,
      },
    ];
  }

  if (existsSync(targetPath)) {
    return [
      {
        kind: "skip",
        path: targetRelative,
        reason: ".env.local already exists; not overwritten",
      },
    ];
  }

  return [
    {
      kind: "copy",
      path: targetRelative,
      reason: "Copy .env.example to .env.local",
    },
  ];
}

function resolveInitRepoRoot(cwd?: string): string {
  const startDir = cwd ? path.resolve(cwd) : process.cwd();

  const contractRoot = findAtlasRepoRoot(startDir);
  if (contractRoot) {
    return contractRoot;
  }

  const structuralRoot = findStructuralAtlasRoot(startDir);
  if (structuralRoot) {
    return structuralRoot;
  }

  throw new CliError(
    CliErrorCode.PROJECT_NOT_FOUND,
    "Atlas project not found. Run init from an Atlas-compatible checkout."
  );
}

function planInit(repoRoot: string, options: InitOptions): CommandResult {
  const contractPath = path.join(repoRoot, ATLAS_CONTRACT_FILENAME);
  const warnings = validatePrerequisites(repoRoot);

  if (existsSync(contractPath)) {
    return {
      repoRoot,
      atlasVersion: readRepoVersion(repoRoot),
      actions: [
        {
          kind: "skip",
          path: ATLAS_CONTRACT_FILENAME,
          reason: "Atlas project already initialized",
        },
      ],
      warnings,
      alreadyInitialized: true,
      referencePolicy: options.reference,
    };
  }

  validateCompatibleStructure(repoRoot);

  return {
    repoRoot,
    atlasVersion: readRepoVersion(repoRoot),
    actions: [
      ...planContractCreation(repoRoot),
      ...planReferenceActions(repoRoot, options.reference),
      ...planEnvActions(repoRoot, options.env),
    ],
    warnings,
    alreadyInitialized: false,
    referencePolicy: options.reference,
  };
}

function buildInitialContract(repoRoot: string): RawAtlasProjectContract {
  const specPath = joinRepoPath(repoRoot, DEFAULT_ATLAS_PROJECT_CONTRACT.generated.openApi.spec);
  const schemaPath = joinRepoPath(
    repoRoot,
    DEFAULT_ATLAS_PROJECT_CONTRACT.generated.openApi.schema
  );
  const hasOpenApi = existsSync(specPath) && existsSync(schemaPath);

  if (hasOpenApi) {
    return { schemaVersion: LATEST_SCHEMA_VERSION };
  }

  return {
    schemaVersion: LATEST_SCHEMA_VERSION,
    capabilities: {
      openApi: false,
    },
  };
}

function applyInitPlan(repoRoot: string, plan: CommandResult): void {
  const initialContract = buildInitialContract(repoRoot);

  for (const action of plan.actions) {
    const absolutePath = joinRepoPath(repoRoot, action.path);

    switch (action.kind) {
      case "create":
        if (action.path === ATLAS_CONTRACT_FILENAME) {
          writeFileSync(absolutePath, `${JSON.stringify(initialContract, null, 2)}\n`, "utf8");
        }
        break;
      case "copy":
        mkdirSync(path.dirname(absolutePath), { recursive: true });
        copyFileSync(
          joinRepoPath(
            repoRoot,
            path.posix.join(DEFAULT_ATLAS_PROJECT_CONTRACT.application.root, ".env.example")
          ),
          absolutePath
        );
        break;
      case "remove":
        rmSync(absolutePath, { recursive: true, force: true });
        break;
      case "skip":
        break;
      default:
        break;
    }
  }
}

export function runInit(options: InitOptions): CommandResult {
  const repoRoot = resolveInitRepoRoot(options.cwd);
  const plan = planInit(repoRoot, options);

  if (!options.dryRun && !plan.alreadyInitialized) {
    applyInitPlan(repoRoot, plan);
  }

  return plan;
}

export function formatInitResult(result: CommandResult, dryRun: boolean): string[] {
  if (result.alreadyInitialized) {
    return [
      "Atlas project already initialized.",
      `Repository root: ${result.repoRoot}`,
      `Atlas version: ${result.atlasVersion}`,
    ];
  }

  const header = dryRun ? "Atlas init dry run." : "Atlas init completed.";

  const lines = [
    header,
    `Repository root: ${result.repoRoot}`,
    `Atlas version: ${result.atlasVersion}`,
    "Actions:",
    ...result.actions.map(
      (action: PlannedAction) =>
        `- ${action.kind}: ${action.path}${action.reason ? ` (${action.reason})` : ""}`
    ),
  ];

  if (result.warnings.length > 0) {
    lines.push("Warnings:");
    for (const warning of result.warnings) {
      lines.push(`- ${warning.message}`);
    }
  }

  return lines;
}
