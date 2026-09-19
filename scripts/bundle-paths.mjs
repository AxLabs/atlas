#!/usr/bin/env node
/**
 * Classify whether changed files should run Bundle Analysis.
 *
 * Generated release snapshots and changeset/version/changelog-only PRs do not
 * trigger a bundle rebuild. Application, UI, dependency, and build-config
 * changes fail closed.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  isReleaseOnlyChange,
  listGitChangedFiles,
  normalizeRepoPath,
  REPO_ROOT,
} from "./lib/ci-path-classification.mjs";

export { REPO_ROOT };

export const BUNDLE_BOOTSTRAP_PATHS = [
  "scripts/bundle-paths.mjs",
  "scripts/__tests__/bundle-paths.test.mjs",
  "scripts/lib/ci-path-classification.mjs",
  ".github/workflows/perf-bundle.yml",
  ".github/actions/run-bundle-analysis-suite/action.yml",
];

function escapeForRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const BOOTSTRAP_ALTERNATION = BUNDLE_BOOTSTRAP_PATHS.map(escapeForRegExp).join("|");

export const BUNDLE_PATH_PATTERN = new RegExp(
  `^(apps/web/|packages/ui/|packages/consent/|package\\.json$|pnpm-lock\\.yaml$|pnpm-workspace\\.yaml$|turbo\\.json$|${BOOTSTRAP_ALTERNATION})`
);

export function isBundleImpactingPath(filePath) {
  const normalized = normalizeRepoPath(filePath);
  if (normalized.startsWith("packages/cli/release-assets/production/")) {
    return false;
  }
  return BUNDLE_PATH_PATTERN.test(normalized);
}

export function classifyBundleChanges(files) {
  if (isReleaseOnlyChange(files)) {
    return { bundle: false, impacting: [] };
  }

  const impacting = files.filter((file) => isBundleImpactingPath(file));
  return {
    bundle: impacting.length > 0,
    impacting,
  };
}

function parseArgs(argv) {
  const options = {
    files: [],
    gitDiff: null,
    event: "pull_request",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--git-diff") {
      const base = argv[index + 1];
      const head = argv[index + 2];
      if (!base || !head) {
        throw new Error("Usage: bundle-paths.mjs --git-diff <base> <head>");
      }
      options.gitDiff = { base, head };
      index += 2;
    } else if (arg === "--event") {
      options.event = argv[index + 1] ?? options.event;
      index += 1;
    } else if (arg === "--files") {
      options.files.push(...argv.slice(index + 1));
      break;
    }
  }

  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.event === "push" || options.event === "workflow_dispatch") {
    process.stdout.write("true\n");
    return;
  }

  const files = options.gitDiff
    ? listGitChangedFiles(options.gitDiff.base, options.gitDiff.head)
    : options.files;
  const result = classifyBundleChanges(files);
  process.stdout.write(result.bundle ? "true\n" : "false\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
