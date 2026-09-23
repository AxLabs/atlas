#!/usr/bin/env node
/**
 * Emit Codecov-compatible LCOV for root `scripts/**` using Node's test runner.
 *
 * This is measurement only — it does not enforce a coverage floor.
 *
 * Script tests share the schedule in `scripts/lib/script-test-schedule.mjs`.
 * Isolated integration tests (CLI Turbo cache regression) run after the
 * instrumented batch without coverage: they only exercise already-covered
 * publish helpers plus live Turbo builds, and a second LCOV stream would
 * duplicate `scripts/lib/npm-publish-dry-run.mjs` hit records.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  discoverScriptTestFileNames,
  partitionScriptTests,
  scriptTestRelativePath,
} from "./lib/script-test-schedule.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(repoRoot, "coverage", "scripts");
const lcovPath = path.join(outputDir, "lcov.info");

const allTests = discoverScriptTestFileNames();
const { parallelTests, isolatedAfterParallelTests } = partitionScriptTests(allTests);

if (allTests.length === 0) {
  throw new Error("No scripts/__tests__/*.test.mjs files found");
}

mkdirSync(outputDir, { recursive: true });

function runInstrumentedTests(fileNames) {
  if (fileNames.length === 0) {
    return 0;
  }

  const testFiles = fileNames.map((name) => scriptTestRelativePath(name));
  const result = spawnSync(
    process.execPath,
    [
      "--test",
      "--experimental-test-coverage",
      "--test-reporter=spec",
      "--test-reporter=lcov",
      "--test-reporter-destination=stdout",
      `--test-reporter-destination=${lcovPath}`,
      "--test-coverage-include=scripts/**/*.mjs",
      "--test-coverage-exclude=scripts/__tests__/**",
      "--test-coverage-exclude=scripts/__fixtures__/**",
      ...testFiles,
    ],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: process.env,
    },
  );

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

function runUninstrumentedTests(fileNames) {
  if (fileNames.length === 0) {
    return 0;
  }

  const testFiles = fileNames.map((name) => scriptTestRelativePath(name));
  const result = spawnSync(
    process.execPath,
    ["--test", "--test-reporter=spec", ...testFiles],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: process.env,
    },
  );

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

const parallelStatus = runInstrumentedTests(parallelTests);
if (parallelStatus !== 0) {
  process.exit(parallelStatus);
}

const isolatedStatus = runUninstrumentedTests(isolatedAfterParallelTests);
if (isolatedStatus !== 0) {
  process.exit(isolatedStatus);
}

console.log(`Wrote script coverage to ${path.relative(repoRoot, lcovPath)}`);
