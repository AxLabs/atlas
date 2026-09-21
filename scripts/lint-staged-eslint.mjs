#!/usr/bin/env node
/**
 * lint-staged task-phase ESLint runner. Invoked after lint-staged hides
 * unstaged changes so ESLint sees the index, not the working tree.
 */
import { parseLintStagedFilenames, runEslintForStagedFiles } from "./lint-staged-utils.mjs";

const filenames = parseLintStagedFilenames(process.argv.slice(2));

try {
  runEslintForStagedFiles(filenames);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
