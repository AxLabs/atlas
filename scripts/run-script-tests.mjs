import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Run script tests with one file last: cli-turbo-build-cache mutates shared
 * packages/cli outputs via Turbo and must not overlap validate-dependencies.test.mjs.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testDir = path.join(repoRoot, "scripts", "__tests__");
const runLast = "cli-turbo-build-cache.test.mjs";

const allTests = readdirSync(testDir)
  .filter((name) => name.endsWith(".test.mjs"))
  .sort((a, b) => a.localeCompare(b));

const parallelTests = allTests.filter((name) => name !== runLast);
const serialTests = allTests.filter((name) => name === runLast);

function runNodeTest(relativePaths) {
  if (relativePaths.length === 0) {
    return 0;
  }

  const result = spawnSync(
    process.execPath,
    ["--test", ...relativePaths.map((relativePath) => path.join("scripts", "__tests__", relativePath))],
    { cwd: repoRoot, stdio: "inherit", env: process.env },
  );

  return result.status ?? 1;
}

const parallelStatus = runNodeTest(parallelTests);
if (parallelStatus !== 0) {
  process.exit(parallelStatus);
}

process.exit(runNodeTest(serialTests));
