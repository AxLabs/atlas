import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  classifyUiQualityChanges,
  isUiQualityImpactingPath,
  REPO_ROOT,
} from "../ui-quality-paths.mjs";

const cli = path.join(REPO_ROOT, "scripts", "ui-quality-paths.mjs");
const workflowPath = path.join(REPO_ROOT, ".github", "workflows", "ui-quality.yml");

function runCli(args, { input } = {}) {
  try {
    const stdout = execFileSync(process.execPath, [cli, ...args], {
      encoding: "utf8",
      cwd: REPO_ROOT,
      input,
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

describe("UI Quality path classification", () => {
  it("classifies a PR that only changes the critical-policy implementation as UI-quality-impacting", () => {
    const result = classifyUiQualityChanges(["scripts/storybook-critical-policy.mjs"]);
    assert.equal(result.ui, true);
    assert.deepEqual(result.impacting, ["scripts/storybook-critical-policy.mjs"]);
  });

  it("classifies critical-policy tests, fixtures, and the path classifier as UI-quality-impacting", () => {
    const files = [
      "scripts/__tests__/storybook-critical-policy.test.mjs",
      "scripts/__fixtures__/storybook-critical-policy/manifest.json",
      "scripts/ui-quality-paths.mjs",
      "scripts/__tests__/ui-quality-paths.test.mjs",
      "packages/ui/.storybook/critical-stories.json",
      "packages/ui/.storybook/a11y-exceptions.json",
    ];

    for (const file of files) {
      assert.equal(isUiQualityImpactingPath(file), true, file);
    }
  });

  it("does not classify unrelated docs or scripts as UI-quality-impacting", () => {
    const result = classifyUiQualityChanges([
      "docs/how-we-build/testing.md",
      "scripts/audit-licenses.mjs",
      "README.md",
    ]);
    assert.equal(result.ui, false);
    assert.deepEqual(result.impacting, []);
  });

  it("CLI reports true for a policy-only file list", () => {
    const result = runCli(["--files", "scripts/storybook-critical-policy.mjs"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "true");
  });

  it("requires the UI Quality workflow to invoke the classifier", () => {
    const workflow = readFileSync(workflowPath, "utf8");
    assert.match(workflow, /node scripts\/ui-quality-paths\.mjs --git-diff/);
    assert.doesNotMatch(
      workflow,
      /git diff --name-only "\$BASE" "\$HEAD" \| grep -qE/
    );
  });
});
