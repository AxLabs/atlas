import { existsSync } from "node:fs";
import path from "node:path";

import { ATLAS_CONTRACT_FILENAME } from "@atlas/project";

import { CliError, CliErrorCode } from "../errors/cli-error";

const MAX_ROOT_WALK_DEPTH = 32;

export function resolveStartingDirectory(cwd?: string): string {
  const start = cwd ? path.resolve(cwd) : process.cwd();

  if (!existsSync(start)) {
    throw new CliError(CliErrorCode.USAGE_ERROR, `Working directory does not exist: ${start}`);
  }

  return start;
}

/** Walk upward from startDir to locate the nearest atlas.config.json. */
export function findAtlasRepoRoot(startDir: string): string | null {
  let current = path.resolve(startDir);
  let depth = 0;

  while (depth <= MAX_ROOT_WALK_DEPTH) {
    const contractPath = path.join(current, ATLAS_CONTRACT_FILENAME);
    if (existsSync(contractPath)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }

    current = parent;
    depth += 1;
  }

  return null;
}

/** Detect a compatible Atlas monorepo layout without a contract file yet. */
export function findStructuralAtlasRoot(startDir: string): string | null {
  let current = path.resolve(startDir);
  let depth = 0;

  while (depth <= MAX_ROOT_WALK_DEPTH) {
    const rootPackageJson = path.join(current, "package.json");
    const webRoot = path.join(current, "apps/web");
    const uiRoot = path.join(current, "packages/ui");

    if (existsSync(rootPackageJson) && existsSync(webRoot) && existsSync(uiRoot)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }

    current = parent;
    depth += 1;
  }

  return null;
}

/**
 * Locate an Atlas repository root for commands that require an initialized contract.
 * Falls back to structural discovery for init when the contract file is absent.
 */
export function findAtlasProjectRoot(
  startDir: string,
  options?: { allowStructural?: boolean }
): string {
  const contractRoot = findAtlasRepoRoot(startDir);
  if (contractRoot) {
    return contractRoot;
  }

  if (options?.allowStructural) {
    const structuralRoot = findStructuralAtlasRoot(startDir);
    if (structuralRoot) {
      return structuralRoot;
    }
  }

  throw new CliError(
    CliErrorCode.PROJECT_NOT_FOUND,
    `Atlas project not found. Expected ${ATLAS_CONTRACT_FILENAME} in the repository root or a compatible Atlas checkout.`
  );
}

export function resolveRepoRootFromOptions(options: {
  cwd?: string;
  allowStructural?: boolean;
}): string {
  const startDir = resolveStartingDirectory(options.cwd);
  return findAtlasProjectRoot(startDir, { allowStructural: options.allowStructural });
}
