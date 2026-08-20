import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  ATLAS_CONTRACT_FILENAME,
  DEFAULT_ATLAS_PROJECT_CONTRACT,
  joinRepoPath,
  LATEST_SCHEMA_VERSION,
  type RawAtlasProjectContract,
  resolveAtlasProject,
} from "@atlas/project";

import { CliError, CliErrorCode } from "../errors/cli-error";
import { cliErrorFromContract } from "../errors/from-contract";
import { validatePrerequisites } from "../init/prerequisites";
import { findAtlasRepoRoot, findStructuralAtlasRoot } from "../project/find-root";
import { readCheckoutAtlasVersion } from "../version";

import type { CommandResult, PlannedAction } from "../types/result";

export type ReferencePolicy = "keep" | "remove";
export type EnvPolicy = "skip" | "copy";

export interface InitOptions {
  cwd?: string;
  dryRun?: boolean;
  reference: ReferencePolicy;
  env: EnvPolicy;
}

const REFERENCE_PATHS = [
  DEFAULT_ATLAS_PROJECT_CONTRACT.features.reference,
  DEFAULT_ATLAS_PROJECT_CONTRACT.features.examples,
  DEFAULT_ATLAS_PROJECT_CONTRACT.reference.components,
  DEFAULT_ATLAS_PROJECT_CONTRACT.reference.routes,
];

function planContractCreation(): PlannedAction[] {
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

interface InitContext {
  repoRoot: string;
  hasExistingContract: boolean;
}

/**
 * Locate a candidate Atlas checkout for init.
 * Structural discovery only checks shallow layout markers; @atlas/project validates contracts.
 */
function resolveInitContext(cwd?: string): InitContext {
  const startDir = cwd ? path.resolve(cwd) : process.cwd();

  const contractRoot = findAtlasRepoRoot(startDir);
  if (contractRoot) {
    return { repoRoot: contractRoot, hasExistingContract: true };
  }

  const structuralRoot = findStructuralAtlasRoot(startDir);
  if (structuralRoot) {
    return { repoRoot: structuralRoot, hasExistingContract: false };
  }

  throw new CliError(
    CliErrorCode.PROJECT_NOT_FOUND,
    "Atlas project not found. Run init from an Atlas-compatible checkout."
  );
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

function validateExistingContract(repoRoot: string): void {
  try {
    resolveAtlasProject(repoRoot);
  } catch (error) {
    throw cliErrorFromContract(error);
  }
}

function validateProposedContract(
  repoRoot: string,
  proposedContract: RawAtlasProjectContract
): void {
  try {
    resolveAtlasProject(repoRoot, proposedContract);
  } catch (error) {
    throw cliErrorFromContract(error);
  }
}

function planInit(context: InitContext, options: InitOptions): CommandResult {
  const { repoRoot, hasExistingContract } = context;
  const warnings = validatePrerequisites(repoRoot);
  const atlasVersion = readCheckoutAtlasVersion(repoRoot);

  if (hasExistingContract) {
    validateExistingContract(repoRoot);

    return {
      repoRoot,
      atlasVersion,
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

  const proposedContract = buildInitialContract(repoRoot);
  validateProposedContract(repoRoot, proposedContract);

  return {
    repoRoot,
    atlasVersion,
    actions: [
      ...planContractCreation(),
      ...planReferenceActions(repoRoot, options.reference),
      ...planEnvActions(repoRoot, options.env),
    ],
    warnings,
    alreadyInitialized: false,
    referencePolicy: options.reference,
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
  const context = resolveInitContext(options.cwd);
  const plan = planInit(context, options);

  if (!options.dryRun && !plan.alreadyInitialized) {
    applyInitPlan(context.repoRoot, plan);
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
