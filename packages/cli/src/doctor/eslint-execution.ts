import path from "node:path";

import type { ESLint } from "eslint";

function toRepoRelativePath(repoRoot: string, filePath: string): string {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

export function extractEslintExecutionFailure(
  repoRoot: string,
  results: ESLint.LintResult[]
): string | undefined {
  for (const result of results) {
    if (result.fatalErrorCount > 0) {
      const relativePath = toRepoRelativePath(repoRoot, result.filePath);
      const fatalMessage = result.messages.find((message) => message.fatal === true);
      if (fatalMessage) {
        return `Parsing error in ${relativePath}: ${fatalMessage.message}`;
      }

      return `Fatal ESLint error in ${relativePath}`;
    }
  }

  return undefined;
}

export function assertNoFatalEslintResults(repoRoot: string, results: ESLint.LintResult[]): void {
  const failure = extractEslintExecutionFailure(repoRoot, results);
  if (failure) {
    throw new Error(failure);
  }
}
