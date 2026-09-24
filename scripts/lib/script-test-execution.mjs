import { spawnSync } from "node:child_process";

import { scriptTestRelativePath } from "./script-test-schedule.mjs";

/**
 * Run script test files in one `node --test` invocation. Node may execute multiple
 * files concurrently — use only for tests that do not share workspace build outputs.
 *
 * @param {string} repoRoot
 * @param {string[]} fileNames basenames under `scripts/__tests__`
 * @param {string[]} [extraNodeArgs] flags inserted after `--test`
 * @returns {number} exit status
 */
export function runScriptTestBatch(repoRoot, fileNames, extraNodeArgs = []) {
  if (fileNames.length === 0) {
    return 0;
  }

  const result = spawnSync(
    process.execPath,
    [
      "--test",
      ...extraNodeArgs,
      ...fileNames.map((fileName) => scriptTestRelativePath(fileName)),
    ],
    { cwd: repoRoot, stdio: "inherit", env: process.env },
  );

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

/**
 * Run each isolated script test in its own `node --test` process so integration
 * tests that mutate shared CLI/project build outputs never run concurrently.
 *
 * @param {string} repoRoot
 * @param {string[]} fileNames ordered basenames from {@link partitionScriptTests}
 * @param {(repoRoot: string, fileNames: string[], extraNodeArgs: string[]) => number} [runBatch]
 * @param {string[]} [extraNodeArgs]
 * @returns {number} exit status
 */
export function runIsolatedScriptTestsSequentially(
  repoRoot,
  fileNames,
  runBatch = runScriptTestBatch,
  extraNodeArgs = [],
) {
  for (const fileName of fileNames) {
    const status = runBatch(repoRoot, [fileName], extraNodeArgs);
    if (status !== 0) {
      return status;
    }
  }

  return 0;
}
