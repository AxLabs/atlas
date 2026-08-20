import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { joinRepoPath } from "@atlas/project";

import { CliError, CliErrorCode } from "../../errors/cli-error";

import type { GenerationPlan } from "../types";

export function applyGenerationPlan(repoRoot: string, plan: GenerationPlan): string[] {
  const writtenPaths: string[] = [];

  try {
    for (const file of plan.files) {
      const absolutePath = joinRepoPath(repoRoot, file.relativePath);
      mkdirSync(path.dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, file.content, "utf8");
      writtenPaths.push(file.relativePath);
    }
  } catch (error) {
    rollbackWrittenFiles(repoRoot, writtenPaths);
    throw new CliError(CliErrorCode.INTERNAL_ERROR, "Failed to apply generator plan.", {
      cause: error,
    });
  }

  return writtenPaths;
}

function rollbackWrittenFiles(repoRoot: string, relativePaths: string[]): void {
  for (const relativePath of [...relativePaths].reverse()) {
    const absolutePath = joinRepoPath(repoRoot, relativePath);
    try {
      rmSync(absolutePath, { force: true });
    } catch {
      // Best-effort rollback only.
    }
  }
}
