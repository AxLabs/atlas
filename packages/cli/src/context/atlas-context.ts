import { readFileSync } from "node:fs";
import path from "node:path";

import {
  LATEST_SCHEMA_VERSION,
  resolveAtlasProject,
  type ResolvedAtlasProject,
} from "@atlas/project";

import { CliError, CliErrorCode } from "../errors/cli-error";
import { cliErrorFromContract } from "../errors/from-contract";
import {
  findAtlasRepoRoot,
  findStructuralAtlasRoot,
  resolveStartingDirectory,
} from "../project/find-root";

export interface AtlasCliContext {
  repoRoot: string;
  atlasVersion: string;
  contractSchemaVersion: number;
  project?: ResolvedAtlasProject;
}

function readAtlasVersion(repoRoot: string): string {
  const packageJsonPath = path.join(repoRoot, "package.json");
  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: unknown };

  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new Error(`Missing version in ${path.join(repoRoot, "package.json")}`);
  }

  return parsed.version;
}

export interface CreateContextOptions {
  cwd?: string;
  requireProject?: boolean;
  allowStructural?: boolean;
}

export function createAtlasContext(options: CreateContextOptions = {}): AtlasCliContext {
  const startDir = resolveStartingDirectory(options.cwd);
  const contractRoot = findAtlasRepoRoot(startDir);

  let repoRoot = contractRoot;
  if (!repoRoot && options.allowStructural) {
    repoRoot = findStructuralAtlasRoot(startDir);
  }

  if (!repoRoot) {
    throw new CliError(
      CliErrorCode.PROJECT_NOT_FOUND,
      "Atlas project not found. Expected atlas.config.json or a compatible Atlas checkout."
    );
  }

  const atlasVersion = readAtlasVersion(repoRoot);
  const context: AtlasCliContext = {
    repoRoot,
    atlasVersion,
    contractSchemaVersion: LATEST_SCHEMA_VERSION,
  };

  if (contractRoot) {
    try {
      context.project = resolveAtlasProject(repoRoot);
    } catch (error) {
      throw cliErrorFromContract(error);
    }
  } else if (options.requireProject) {
    throw new CliError(
      CliErrorCode.PROJECT_NOT_FOUND,
      "Atlas project contract not found. Run `atlas init` to create atlas.config.json."
    );
  }

  return context;
}

export function loadProjectContext(context: AtlasCliContext): ResolvedAtlasProject {
  if (context.project) {
    return context.project;
  }

  try {
    const project = resolveAtlasProject(context.repoRoot);
    context.project = project;
    return project;
  } catch (error) {
    throw cliErrorFromContract(error);
  }
}
