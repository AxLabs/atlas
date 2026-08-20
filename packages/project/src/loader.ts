import { existsSync, readFileSync, statSync } from "node:fs";
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

type PathKind = "directory" | "file";

function validatePathKind(
  repoRoot: string,
  label: string,
  relativePath: string,
  expectedKind: PathKind
): string | null {
  const absolutePath = joinRepoPath(repoRoot, relativePath);

  if (!existsSync(absolutePath)) {
    return `Missing path declared in contract: ${label} (${relativePath})`;
  }

  let stat;
  try {
    stat = statSync(absolutePath);
  } catch {
    return `Unable to read path declared in contract: ${label} (${relativePath})`;
  }

  const actualKind: PathKind = stat.isDirectory() ? "directory" : "file";
  if (actualKind !== expectedKind) {
    return `Expected ${label} to be a ${expectedKind}:\n${relativePath}`;
  }

  return null;
}

function validateUiPackageIdentity(repoRoot: string, project: ResolvedAtlasProject): string[] {
  const packageJsonRelativePath = path.posix.join(project.ui.path, "package.json");
  const packageJsonAbsolutePath = joinRepoPath(repoRoot, packageJsonRelativePath);

  if (!existsSync(packageJsonAbsolutePath)) {
    return [
      `Missing UI package manifest declared in contract: ui.path/package.json (${packageJsonRelativePath})`,
    ];
  }

  let stat;
  try {
    stat = statSync(packageJsonAbsolutePath);
  } catch {
    return [
      `Unable to read UI package manifest declared in contract: ui.path/package.json (${packageJsonRelativePath})`,
    ];
  }

  if (!stat.isFile()) {
    return [`Expected ui.path/package.json to be a file:\n${packageJsonRelativePath}`];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(packageJsonAbsolutePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    return [
      `UI package manifest at ui.path/package.json contains invalid JSON (${packageJsonRelativePath}): ${message}`,
    ];
  }

  if (typeof parsed !== "object" || parsed === null || !("name" in parsed)) {
    return [
      `UI package manifest at ui.path/package.json is missing a package name (${packageJsonRelativePath})`,
    ];
  }

  const packageName = (parsed as { name: unknown }).name;
  if (typeof packageName !== "string" || packageName.length === 0) {
    return [
      `UI package manifest at ui.path/package.json is missing a package name (${packageJsonRelativePath})`,
    ];
  }

  if (packageName !== project.ui.package) {
    return [
      `Atlas contract UI package mismatch:\nui.package declares "${project.ui.package}"\nbut ${packageJsonRelativePath} declares "${packageName}".`,
    ];
  }

  return [];
}

function validateResolvedStructure(repoRoot: string, project: ResolvedAtlasProject): void {
  const errors: string[] = [];

  const requiredDirectories = [
    { label: "application.root", relativePath: project.application.root },
    { label: "features.product", relativePath: project.features.product },
    { label: "ui.path", relativePath: project.ui.path },
  ];

  for (const entry of requiredDirectories) {
    const error = validatePathKind(repoRoot, entry.label, entry.relativePath, "directory");
    if (error) {
      errors.push(error);
    }
  }

  if (project.capabilities.openApi) {
    const requiredOpenApiFiles = [
      { label: "generated.openApi.spec", relativePath: project.generated.openApi.spec },
      { label: "generated.openApi.schema", relativePath: project.generated.openApi.schema },
    ];

    for (const entry of requiredOpenApiFiles) {
      const error = validatePathKind(repoRoot, entry.label, entry.relativePath, "file");
      if (error) {
        errors.push(error);
      }
    }
  }

  errors.push(...validateUiPackageIdentity(repoRoot, project));

  if (errors.length > 0) {
    throw new AtlasContractError(
      AtlasContractErrorCode.CONTRACT_STRUCTURE_INVALID,
      formatValidationErrors(errors),
      errors
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
