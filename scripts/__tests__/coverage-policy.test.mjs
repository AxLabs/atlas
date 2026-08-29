import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  evaluateCoveragePolicy,
  evaluateSubsystem,
  loadCoverageReport,
  loadPolicy,
  REPO_ROOT,
  resolveReportPaths,
} from "../coverage-policy.mjs";

const fixtures = path.join(REPO_ROOT, "scripts", "__fixtures__", "coverage-policy");
const cli = path.join(REPO_ROOT, "scripts", "coverage-policy.mjs");

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

describe("coverage policy evaluator", () => {
  it("fails when the coverage report is missing", () => {
    const policy = loadPolicy(path.join(fixtures, "policy-web-api.json"));
    const evaluation = evaluateCoveragePolicy({
      policy,
      reports: { web: path.join(fixtures, "does-not-exist.json") },
    });
    assert.equal(evaluation.ok, false);
    assert.match(evaluation.failures.join("\n"), /Missing coverage report/);
  });

  it("fails when a subsystem matches zero files", () => {
    const report = loadCoverageReport(path.join(fixtures, "passing-web.json"));
    const result = evaluateSubsystem(
      {
        id: "web-api",
        include: ["**/apps/web/src/lib/does-not-exist/**"],
        thresholds: { statements: 85 },
      },
      report
    );
    assert.equal(result.ok, false);
    assert.equal(result.reason, "zero-matched-files");
  });

  it("fails when a HIGH-risk subsystem is below threshold", () => {
    const result = runCli([
      "--policy",
      path.join(fixtures, "policy-web-api.json"),
      "--report",
      "web",
      path.join(fixtures, "below-threshold-web-api.json"),
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /web-api statements:/);
  });

  it("passes a subsystem that meets the floor", () => {
    const policy = loadPolicy(path.join(fixtures, "policy-web-api.json"));
    const reports = resolveReportPaths(policy, {
      web: path.join(fixtures, "passing-web.json"),
    });
    const evaluation = evaluateCoveragePolicy({ policy, reports });
    assert.equal(evaluation.ok, true, evaluation.failures.join("\n"));
  });
});
