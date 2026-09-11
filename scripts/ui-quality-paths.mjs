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
 * Minimal, explicit allowlist of enforcement-infrastructure paths/prefixes: the UI Quality
 * classifier itself, the critical-policy checker, their tests/fixtures, the manifests they
 * enforce, and the workflow file that wires them together.
 *
 * This is the single source of truth for the *bootstrap guard* duplicated (by hand, necessarily)
 * as `BOOTSTRAP_PATTERN` in `.github/workflows/ui-quality.yml`'s "Detect UI changes" step. That
 * guard intentionally does NOT call into this module: this file (and `isUiQualityImpactingPath`
 * below) is exactly what it protects, so it must still force `ui=true` even if this script is
 * broken, deleted, or has been changed to (wrongly) classify its own diff as non-impacting.
 * `scripts/__tests__/ui-quality-paths.test.mjs` asserts the workflow's embedded pattern matches
 * every path here, so the two lists cannot silently drift apart.
 *
 * Also covers transitive code executed by the policy checker: `storybook-critical-policy.mjs`
 * imports `license-exceptions.mjs` (which imports `license-policy.mjs`) for exception-date
 * validation, so changes there can alter policy behavior and must classify as impacting too.
 *
 * Keep this list small and explicit. Ordinary product/config changes are handled by the broader
 * patterns in `UI_QUALITY_PATH_PATTERN` below, not by this allowlist.
 */
export const UI_QUALITY_BOOTSTRAP_PATHS = [
  "scripts/ui-quality-paths.mjs",
  "scripts/__tests__/ui-quality-paths.test.mjs",
  "scripts/storybook-critical-policy.mjs",
  "scripts/__tests__/storybook-critical-policy.test.mjs",
  "scripts/__fixtures__/storybook-critical-policy/",
  "scripts/license-exceptions.mjs",
  "scripts/license-policy.mjs",
  "packages/ui/.storybook/critical-stories.json",
  "packages/ui/.storybook/a11y-exceptions.json",
  ".github/workflows/ui-quality.yml",
];

function escapeForRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const BOOTSTRAP_ALTERNATION = UI_QUALITY_BOOTSTRAP_PATHS.map(escapeForRegExp).join("|");

/**
 * UI Quality must run when product UI, shared visual config, lockfiles, the
 * workflow itself, or the Storybook critical-policy enforcement surface changes.
 */
export const UI_QUALITY_PATH_PATTERN = new RegExp(
  `^(packages/ui/|packages/config/|package\\.json$|pnpm-lock\\.yaml$|pnpm-workspace\\.yaml$|turbo\\.json$|${BOOTSTRAP_ALTERNATION})`
);

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
