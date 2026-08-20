import path from "node:path";

import {
  AtlasContractError,
  AtlasContractErrorCode,
  resolveAtlasProject,
  type ResolvedAtlasProject,
} from "@atlas/project";

import {
  findAtlasRepoRoot,
  findStructuralAtlasRoot,
  resolveStartingDirectory,
} from "../project/find-root";
import { readCheckoutAtlasVersion, readCliAtlasVersion } from "../version";

export interface DoctorContext {
  repoRoot: string;
  projectRootRelative: string;
  atlasVersion: string;
  checkoutAtlasVersion: string;
  project?: ResolvedAtlasProject;
  contractError?: AtlasContractError;
}

export interface CreateDoctorContextOptions {
  cwd?: string;
}

export function createDoctorContext(options: CreateDoctorContextOptions = {}): DoctorContext {
  const startDir = resolveStartingDirectory(options.cwd);
  const contractRoot = findAtlasRepoRoot(startDir);
  const repoRoot = contractRoot ?? findStructuralAtlasRoot(startDir) ?? startDir;

  if (!contractRoot) {
    return {
      repoRoot,
      projectRootRelative: normalizeProjectRootRelative(repoRoot, startDir),
      atlasVersion: readCliAtlasVersion(),
      checkoutAtlasVersion: safeReadCheckoutVersion(repoRoot),
      contractError: new AtlasContractError(
        AtlasContractErrorCode.CONTRACT_NOT_FOUND,
        "Atlas contract not found at atlas.config.json. Expected file at repository root."
      ),
    };
  }

  const checkoutAtlasVersion = safeReadCheckoutVersion(repoRoot);
  const context: DoctorContext = {
    repoRoot,
    projectRootRelative: normalizeProjectRootRelative(repoRoot, startDir),
    atlasVersion: readCliAtlasVersion(),
    checkoutAtlasVersion,
  };

  try {
    context.project = resolveAtlasProject(repoRoot);
  } catch (error) {
    if (error instanceof AtlasContractError) {
      context.contractError = error;
    } else {
      throw error;
    }
  }

  return context;
}

function safeReadCheckoutVersion(repoRoot: string): string {
  try {
    return readCheckoutAtlasVersion(repoRoot);
  } catch {
    return readCliAtlasVersion();
  }
}

function normalizeProjectRootRelative(repoRoot: string, startDir: string): string {
  const relative = path.relative(startDir, repoRoot);
  if (relative === "") {
    return ".";
  }

  return relative.split(path.sep).join("/");
}
