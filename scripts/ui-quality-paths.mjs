#!/usr/bin/env node
/**
 * Classify whether changed files should run the UI Quality workflow.
 *
 * The workflow invokes this script so Storybook policy enforcement cannot
 * change without being classified as UI-quality-impacting.
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..");

/**
 * UI Quality must run when product UI, shared visual config, lockfiles, the
 * workflow itself, or the Storybook critical-policy enforcement surface changes.
 */
export const UI_QUALITY_PATH_PATTERN =
  /^(packages\/ui\/|packages\/config\/|package\.json$|pnpm-lock\.yaml$|pnpm-workspace\.yaml$|turbo\.json$|\.github\/workflows\/ui-quality\.yml$|scripts\/(?:ui-quality-paths|storybook-critical-policy)|scripts\/__tests__\/(?:ui-quality-paths|storybook-critical-policy)|scripts\/__fixtures__\/storybook-critical-policy)/;

export function normalizeRepoPath(filePath) {
  return String(filePath)
    .replaceAll("\\", "/")
    .replace(/^\.\//, "");
}

export function isUiQualityImpactingPath(filePath) {
  return UI_QUALITY_PATH_PATTERN.test(normalizeRepoPath(filePath));
}

export function classifyUiQualityChanges(files) {
  const impacting = files.filter((file) => isUiQualityImpactingPath(file));
  return {
    ui: impacting.length > 0,
    impacting,
  };
}

export function listGitChangedFiles(base, head, { cwd = REPO_ROOT } = {}) {
  const stdout = execFileSync("git", ["diff", "--name-only", base, head], {
    encoding: "utf8",
    cwd,
  });
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const options = {
    files: [],
    gitDiff: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--git-diff") {
      const base = argv[index + 1];
      const head = argv[index + 2];
      if (!base || !head) {
        throw new Error("Usage: ui-quality-paths.mjs --git-diff <base> <head>");
      }
      options.gitDiff = { base, head };
      index += 2;
    } else if (arg === "--files") {
      options.files.push(...argv.slice(index + 1));
      break;
    }
  }

  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const files = options.gitDiff
    ? listGitChangedFiles(options.gitDiff.base, options.gitDiff.head)
    : options.files;
  const result = classifyUiQualityChanges(files);
  process.stdout.write(result.ui ? "true\n" : "false\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
