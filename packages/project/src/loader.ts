import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { ATLAS_CONTRACT_FILENAME } from "./constants";
import { resolveAtlasProjectContract } from "./defaults";
import { AtlasContractError, AtlasContractErrorCode, formatValidationErrors } from "./errors";
import { joinRepoPath } from "./paths";
import {
  parseAtlasProjectContract,
  type RawAtlasProjectContract,
  type ResolvedAtlasProject,
} from "./schema";

export function findAtlasContractPath(repoRoot: string): string {
  return path.join(repoRoot, ATLAS_CONTRACT_FILENAME);
}

export function readAtlasProjectContractFile(
  repoRoot: string,
  contractPath = findAtlasContractPath(repoRoot)
): RawAtlasProjectContract {
  if (!existsSync(contractPath)) {
    throw new AtlasContractError(
      AtlasContractErrorCode.CONTRACT_NOT_FOUND,
      `Atlas contract not found at ${ATLAS_CONTRACT_FILENAME}. Expected file at repository root.`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(contractPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    throw new AtlasContractError(
      AtlasContractErrorCode.CONTRACT_INVALID_JSON,
      `Atlas contract at ${ATLAS_CONTRACT_FILENAME} contains invalid JSON: ${message}`
    );
  }

  return parseAtlasProjectContract(parsed);
}

export function loadAtlasProject(repoRoot: string): RawAtlasProjectContract {
  return readAtlasProjectContractFile(repoRoot);
}

function validateResolvedStructure(repoRoot: string, project: ResolvedAtlasProject): void {
  const requiredPaths = [
    { label: "application.root", relativePath: project.application.root },
    { label: "features.product", relativePath: project.features.product },
    { label: "features.reference", relativePath: project.features.reference },
    { label: "features.examples", relativePath: project.features.examples },
    { label: "reference.components", relativePath: project.reference.components },
    { label: "reference.routes", relativePath: project.reference.routes },
    { label: "ui.path", relativePath: project.ui.path },
    { label: "generated.openApi.spec", relativePath: project.generated.openApi.spec },
    { label: "generated.openApi.schema", relativePath: project.generated.openApi.schema },
  ];

  const missing: string[] = [];
  for (const entry of requiredPaths) {
    const absolutePath = joinRepoPath(repoRoot, entry.relativePath);
    if (!existsSync(absolutePath)) {
      missing.push(`${entry.label} (${entry.relativePath})`);
    }
  }

  if (missing.length > 0) {
    throw new AtlasContractError(
      AtlasContractErrorCode.CONTRACT_STRUCTURE_INVALID,
      formatValidationErrors(missing.map((entry) => `Missing path declared in contract: ${entry}`)),
      missing.map((entry) => `Missing path declared in contract: ${entry}`)
    );
  }
}

export function resolveAtlasProject(
  repoRoot: string,
  raw?: RawAtlasProjectContract
): ResolvedAtlasProject {
  const contract = raw ?? readAtlasProjectContractFile(repoRoot);
  const resolved = resolveAtlasProjectContract(contract);
  validateResolvedStructure(repoRoot, resolved);
  return resolved;
}
