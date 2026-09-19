#!/usr/bin/env node
/**
 * Emit Codecov-compatible LCOV for root `scripts/**` using Node's test runner.
 *
 * This is measurement only — it does not enforce a coverage floor.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(repoRoot, "coverage", "scripts");
const lcovPath = path.join(outputDir, "lcov.info");
const testsDir = path.join(repoRoot, "scripts", "__tests__");
const testFiles = readdirSync(testsDir)
  .filter((name) => name.endsWith(".test.mjs"))
  .map((name) => path.join("scripts", "__tests__", name))
  .sort();

if (testFiles.length === 0) {
  throw new Error("No scripts/__tests__/*.test.mjs files found");
}

mkdirSync(outputDir, { recursive: true });

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
  }
);

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Wrote script coverage to ${path.relative(repoRoot, lcovPath)}`);
