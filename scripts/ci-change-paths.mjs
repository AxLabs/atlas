#!/usr/bin/env node
/**
 * Classify whether changed files should run the application CI suite and/or
 * `pnpm distribution:verify`.
 *
 * Fail closed: ambiguous packaging, CLI, workspace, and publish surfaces run
 * the clean-room lifecycle. Ordinary product source that is only consumed via
 * in-repo tests/build does not.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  listGitChangedFiles,
  normalizeRepoPath,
  REPO_ROOT,
} from "./lib/ci-path-classification.mjs";

export { REPO_ROOT };

/**
 * Application CI (install, lint, typecheck, coverage, build, E2E).
 * Broader than distribution: any product, package, script, or CI-contract change.
 */
export const APP_PATH_PATTERN =
  /^(apps\/|packages\/|openapi\/|scripts\/|\.github\/workflows\/ci\.yml|\.github\/actions\/run-ci-suite\/|turbo\.json|package\.json$|pnpm-lock\.yaml$|pnpm-workspace\.yaml$|tsconfig.*\.json|eslint\.config)/;

/**
 * Source that is copied into generated consumers but is already proven by the
 * in-repo application suite. Clean-room still runs when workspace metadata or
 * CLI/bootstrap/templates change.
 */
export const NON_DISTRIBUTION_SOURCE_PATTERN =
  /^(apps\/reference\/|apps\/web\/src\/|apps\/web\/e2e\/|packages\/ui\/src\/|packages\/ui\/\.storybook\/|packages\/ui\/visual-tests\/|packages\/ui\/scripts\/|packages\/ui\/playwright|packages\/ui\/README\.md$|packages\/ui\/\.husky\/)/;

/**
 * Surfaces that can change packed CLI behavior, generated consumers, or npm
 * publication. Unknown files under these prefixes fail closed.
 */
export const DISTRIBUTION_CRITICAL_PATTERN =
  /^(packages\/cli\/|packages\/project\/|packages\/config\/|packages\/consent\/|templates\/|openapi\/|atlas\.config\.json$|pnpm-workspace\.yaml$|turbo\.json$|package\.json$|pnpm-lock\.yaml$|eslint\.config|lighthouserc\.json$|\.npmrc$|\.nvmrc$|\.prettierrc|\.prettierignore$|\.gitignore$|jest\.config\.js$|AGENTS\.md$|LICENSE$|THIRD_PARTY_NOTICES\.md$|\.changeset\/|\.github\/workflows\/(ci|release)\.yml$|\.github\/actions\/run-ci-suite\/|scripts\/ensure-pnpm\.js$|scripts\/ci-change-paths\.mjs$|scripts\/lib\/ci-path-classification\.mjs$|scripts\/__tests__\/ci-change-paths\.test\.mjs$|scripts\/__tests__\/ci-path-classification\.test\.mjs$|scripts\/(.*distribution.*|.*npm.*|.*publish.*|release-.*|consolidate-atlas-release.*)|docs\/how-we-build\/(agents|architecture-ownership|atlas-contract|cli|doctor|upgrades|api|authorization|testing|folder-structure|examples|security|releases-and-governance)\.md$|docs\/security\/threat-model\.md$|docs\/adr\/000[7-9]|docs\/adr\/0010|docs\/adr\/0011|apps\/web\/|packages\/ui\/)/;

export function isAppImpactingPath(filePath) {
  return APP_PATH_PATTERN.test(normalizeRepoPath(filePath));
}

export function isDistributionCriticalPath(filePath) {
  const normalized = normalizeRepoPath(filePath);
  if (NON_DISTRIBUTION_SOURCE_PATTERN.test(normalized)) {
    return false;
  }
  return DISTRIBUTION_CRITICAL_PATTERN.test(normalized);
}

export function classifyCiChanges(files) {
  const normalized = files.map(normalizeRepoPath).filter(Boolean);
  const appFiles = normalized.filter((file) => isAppImpactingPath(file));
  const distributionFiles = normalized.filter((file) => isDistributionCriticalPath(file));
  return {
    app: appFiles.length > 0,
    distribution: distributionFiles.length > 0,
    appFiles,
    distributionFiles,
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
        throw new Error("Usage: ci-change-paths.mjs --git-diff <base> <head>");
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
    process.stdout.write("app=true\ndistribution=true\n");
    return;
  }

  const files = options.gitDiff
    ? listGitChangedFiles(options.gitDiff.base, options.gitDiff.head)
    : options.files;
  const result = classifyCiChanges(files);
  process.stdout.write(`app=${result.app}\ndistribution=${result.distribution}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
