import { existsSync } from "node:fs";

import { joinRepoPath } from "@atlas/project";

import { CliError, CliErrorCode } from "../../errors/cli-error";

import type { PlannedAction } from "../../types/result";
import type { GeneratedFile, GenerationPlan, GeneratorType } from "../types";

export interface BuildGenerationPlanOptions {
  repoRoot: string;
  generatorType: GeneratorType;
  normalizedInput: string;
  targetRoot: string;
  files: GeneratedFile[];
  followUpActions: string[];
  rejectExistingFeatureDirectory?: boolean;
}

export function buildGenerationPlan(options: BuildGenerationPlanOptions): GenerationPlan {
  const conflicts: string[] = [];
  const actions: PlannedAction[] = [];

  if (options.rejectExistingFeatureDirectory) {
    const featureDirectory = joinRepoPath(options.repoRoot, options.targetRoot);
    if (existsSync(featureDirectory)) {
      conflicts.push(`${options.targetRoot}/ (directory already exists)`);
    }
  }

  for (const file of options.files) {
    const absolutePath = joinRepoPath(options.repoRoot, file.relativePath);
    if (existsSync(absolutePath)) {
      conflicts.push(file.relativePath);
      actions.push({
        kind: "conflict",
        path: file.relativePath,
        reason: "Destination file already exists",
      });
      continue;
    }

    actions.push({
      kind: "create",
      path: file.relativePath,
    });
  }

  if (conflicts.length > 0) {
    throw new CliError(CliErrorCode.GENERATOR_CONFLICT, "Generator conflict detected.", {
      details: conflicts.map((entry) => `${entry} already exists`),
    });
  }

  return {
    generatorType: options.generatorType,
    normalizedInput: options.normalizedInput,
    targetRoot: options.targetRoot,
    files: options.files,
    actions,
    followUpActions: options.followUpActions,
  };
}
