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
  atlasVersion: string;
  checkoutAtlasVersion?: string;
  checkoutVersionError?: string;
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

  const checkoutVersion = readCheckoutVersionMetadata(repoRoot);
  const contextBase = {
    repoRoot,
    atlasVersion: readCliAtlasVersion(),
    checkoutAtlasVersion: checkoutVersion.version,
    checkoutVersionError: checkoutVersion.error,
  };

  if (!contractRoot) {
    return {
      ...contextBase,
      contractError: new AtlasContractError(
        AtlasContractErrorCode.CONTRACT_NOT_FOUND,
        "Atlas contract not found at atlas.config.json. Expected file at repository root."
      ),
    };
  }

  const context: DoctorContext = { ...contextBase };

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

function readCheckoutVersionMetadata(repoRoot: string): { version?: string; error?: string } {
  try {
    return { version: readCheckoutAtlasVersion(repoRoot) };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to read checkout version from root package.json.",
    };
  }
}
