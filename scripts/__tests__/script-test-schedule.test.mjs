import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  discoverScriptTestFileNames,
  ISOLATED_AFTER_PARALLEL_SCRIPT_TESTS,
  partitionScriptTests,
  REPO_ROOT,
} from "../lib/script-test-schedule.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("script test schedule", () => {
  it("partitions every discovered test file without overlap", () => {
    const all = discoverScriptTestFileNames();
    const { parallelTests, isolatedAfterParallelTests } = partitionScriptTests(all);

    assert.ok(all.length > 0);
    assert.equal(parallelTests.length + isolatedAfterParallelTests.length, all.length);

    const union = new Set([...parallelTests, ...isolatedAfterParallelTests]);
    assert.equal(union.size, all.length);
    for (const name of all) {
      assert.equal(union.has(name), true, `missing partition for ${name}`);
    }
  });

  it("serializes CLI Turbo cache regression after validate-dependencies", () => {
    assert.deepEqual(ISOLATED_AFTER_PARALLEL_SCRIPT_TESTS, ["cli-turbo-build-cache.test.mjs"]);

    const { parallelTests, isolatedAfterParallelTests } = partitionScriptTests(
      discoverScriptTestFileNames(),
    );

    assert.equal(isolatedAfterParallelTests.at(-1), "cli-turbo-build-cache.test.mjs");
    assert.equal(parallelTests.includes("validate-dependencies.test.mjs"), true);
    assert.equal(isolatedAfterParallelTests.includes("validate-dependencies.test.mjs"), false);
  });

  it("is the single source of truth for script test runners", () => {
    const scheduleImport = /script-test-schedule\.mjs/;
    const runners = ["scripts/run-script-tests.mjs", "scripts/collect-scripts-coverage.mjs"];

    for (const relativePath of runners) {
      const source = readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
      assert.match(source, scheduleImport, `${relativePath} must import script-test-schedule.mjs`);
      assert.doesNotMatch(
        source,
        /readdirSync\([\s\S]*__tests__/,
        `${relativePath} must not rediscover tests independently`,
      );
    }
  });
});
