import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  discoverScriptTestFileNames,
  partitionScriptTests,
  scriptTestRelativePath,
} from "./lib/script-test-schedule.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runNodeTest(relativePaths) {
  if (relativePaths.length === 0) {
    return 0;
  }

  const result = spawnSync(
    process.execPath,
    ["--test", ...relativePaths.map((relativePath) => scriptTestRelativePath(relativePath))],
    { cwd: repoRoot, stdio: "inherit", env: process.env },
  );

  return result.status ?? 1;
}

const allTests = discoverScriptTestFileNames();
const { parallelTests, isolatedAfterParallelTests } = partitionScriptTests(allTests);

const parallelStatus = runNodeTest(parallelTests);
if (parallelStatus !== 0) {
  process.exit(parallelStatus);
}

process.exit(runNodeTest(isolatedAfterParallelTests));
