#!/usr/bin/env node
/**
 * Emit Codecov-compatible LCOV for root `scripts/**` using Node's test runner.
 *
 * This is measurement only — it does not enforce a coverage floor.
 *
 * Script tests share the schedule in `scripts/lib/script-test-schedule.mjs`.
 * Isolated shared-build-output integration tests run sequentially after the
 * instrumented batch without coverage: they exercise live Turbo/project builds
 * and already-covered release helpers, and a second LCOV stream would
 * duplicate hit records.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  runIsolatedScriptTestsSequentially,
  runScriptTestBatch,
} from "./lib/script-test-execution.mjs";
import { discoverScriptTestFileNames, partitionScriptTests } from "./lib/script-test-schedule.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(repoRoot, "coverage", "scripts");
const lcovPath = path.join(outputDir, "lcov.info");

const allTests = discoverScriptTestFileNames();
const { parallelTests, isolatedAfterParallelTests } = partitionScriptTests(allTests);

if (allTests.length === 0) {
  throw new Error("No scripts/__tests__/*.test.mjs files found");
}

mkdirSync(outputDir, { recursive: true });

const instrumentedCoverageArgs = [
  "--experimental-test-coverage",
  "--test-reporter=spec",
  "--test-reporter=lcov",
  "--test-reporter-destination=stdout",
  `--test-reporter-destination=${lcovPath}`,
  "--test-coverage-include=scripts/**/*.mjs",
  "--test-coverage-exclude=scripts/__tests__/**",
  "--test-coverage-exclude=scripts/__fixtures__/**",
];

const uninstrumentedReporterArgs = ["--test-reporter=spec"];

const parallelStatus = runScriptTestBatch(repoRoot, parallelTests, instrumentedCoverageArgs);
if (parallelStatus !== 0) {
  process.exit(parallelStatus);
}

const isolatedStatus = runIsolatedScriptTestsSequentially(
  repoRoot,
  isolatedAfterParallelTests,
  runScriptTestBatch,
  uninstrumentedReporterArgs,
);
if (isolatedStatus !== 0) {
  process.exit(isolatedStatus);
}

console.log(`Wrote script coverage to ${path.relative(repoRoot, lcovPath)}`);
