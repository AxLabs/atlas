import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  evaluateCriticalStoryPolicy,
  REPO_ROOT,
} from "../storybook-critical-policy.mjs";

const fixtures = path.join(REPO_ROOT, "scripts", "__fixtures__", "storybook-critical-policy");
const cli = path.join(REPO_ROOT, "scripts", "storybook-critical-policy.mjs");

function runCli(args) {
  try {
    const stdout = execFileSync(process.execPath, [cli, ...args], {
      encoding: "utf8",
      cwd: REPO_ROOT,
    });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return {
      status: error.status ?? 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    };
  }
}

describe("storybook critical policy", () => {
  it("passes the repository manifest against current stories", () => {
    const result = evaluateCriticalStoryPolicy();
    assert.equal(result.ok, true, result.failures.join("\n"));
    assert.equal(result.storyCount, 10);
  });

  it("fails when a required critical tag is removed", () => {
    const result = evaluateCriticalStoryPolicy({
      repoRoot: fixtures,
      manifestPath: path.join(fixtures, "manifest.json"),
      exceptionsPath: path.join(fixtures, "a11y-exceptions.json"),
    });
    assert.equal(result.ok, false);
    assert.match(result.failures.join("\n"), /missing required critical tag/);
  });

  it("fails when a required play interaction is removed", () => {
    const result = evaluateCriticalStoryPolicy({
      repoRoot: fixtures,
      manifestPath: path.join(fixtures, "manifest-no-play.json"),
      exceptionsPath: path.join(fixtures, "a11y-exceptions.json"),
    });
    assert.equal(result.ok, false);
    assert.match(result.failures.join("\n"), /missing required play interaction/);
  });

  it("fails when axe is disabled on a protected story", () => {
    const result = evaluateCriticalStoryPolicy({
      repoRoot: fixtures,
      manifestPath: path.join(fixtures, "manifest-a11y-disable.json"),
      exceptionsPath: path.join(fixtures, "a11y-exceptions.json"),
    });
    assert.equal(result.ok, false);
    assert.match(result.failures.join("\n"), /a11y\.disable=true/);
  });

  it("fails when an axe rule is weakened without a documented exception", () => {
    const result = evaluateCriticalStoryPolicy({
      repoRoot: fixtures,
      manifestPath: path.join(fixtures, "manifest-rule-disable.json"),
      exceptionsPath: path.join(fixtures, "a11y-exceptions.json"),
    });
    assert.equal(result.ok, false);
    assert.match(result.failures.join("\n"), /without documented exception/);
  });

  it("fails when an exception is stale", () => {
    const result = evaluateCriticalStoryPolicy({
      repoRoot: fixtures,
      manifestPath: path.join(fixtures, "manifest-rule-disable.json"),
      exceptionsPath: path.join(fixtures, "a11y-exceptions-stale.json"),
    });
    assert.equal(result.ok, false);
    assert.match(result.failures.join("\n"), /expired exception/);
  });

  it("CLI exits non-zero on policy failure", () => {
    const result = runCli([
      "--repo-root",
      fixtures,
      "--manifest",
      path.join(fixtures, "manifest.json"),
      "--exceptions",
      path.join(fixtures, "a11y-exceptions.json"),
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stderr + result.stdout, /FAILED/);
  });
});
