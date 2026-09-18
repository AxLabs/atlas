import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  classifyUiQualityChanges,
  isUiQualityImpactingPath,
  REPO_ROOT,
  UI_QUALITY_BOOTSTRAP_PATHS,
} from "../ui-quality-paths.mjs";

const cli = path.join(REPO_ROOT, "scripts", "ui-quality-paths.mjs");
const workflowPath = path.join(REPO_ROOT, ".github", "workflows", "ui-quality.yml");
const suiteActionPath = path.join(REPO_ROOT, ".github", "actions", "run-ui-quality-suite", "action.yml");

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

  it("classifies every enforcement-infrastructure bootstrap path as UI-quality-impacting", () => {
    // UI_QUALITY_BOOTSTRAP_PATHS is the source of truth for both this classifier and the
    // workflow's independent bootstrap guard (see the "bootstrap guard" describe block below).
    // A directory-prefix entry (trailing "/") is exercised with a representative file under it.
    for (const bootstrapPath of UI_QUALITY_BOOTSTRAP_PATHS) {
      const sample = bootstrapPath.endsWith("/") ? `${bootstrapPath}manifest.json` : bootstrapPath;
      assert.equal(isUiQualityImpactingPath(sample), true, sample);
    }
  });

  it("classifies the critical-policy checker's transitive license dependencies as UI-quality-impacting", () => {
    // storybook-critical-policy.mjs imports license-exceptions.mjs (which imports
    // license-policy.mjs) for exception-date validation; changes there can alter policy behavior.
    const result = classifyUiQualityChanges([
      "scripts/license-exceptions.mjs",
      "scripts/license-policy.mjs",
    ]);
    assert.equal(result.ui, true);
    assert.deepEqual(result.impacting, ["scripts/license-exceptions.mjs", "scripts/license-policy.mjs"]);
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

  it("requires the UI Quality workflow to invoke the classifier for ordinary changes", () => {
    const workflow = readFileSync(workflowPath, "utf8");
    const suiteAction = readFileSync(suiteActionPath, "utf8");
    assert.match(
      `${workflow}\n${suiteAction}`,
      /node scripts\/ui-quality-paths\.mjs --git-diff/,
    );
  });
});

describe("UI Quality workflow bootstrap guard (self-protection)", () => {
  const suiteAction = readFileSync(suiteActionPath, "utf8");

  it("declares an explicit BOOTSTRAP_PATTERN in the Detect UI changes step", () => {
    assert.match(suiteAction, /BOOTSTRAP_PATTERN='[^']+'/);
  });

  it("evaluates the bootstrap guard before invoking the classifier script", () => {
    const bootstrapIndex = suiteAction.indexOf("BOOTSTRAP_PATTERN=");
    const classifierIndex = suiteAction.indexOf("node scripts/ui-quality-paths.mjs --git-diff");
    assert.ok(bootstrapIndex >= 0, "workflow must declare BOOTSTRAP_PATTERN");
    assert.ok(classifierIndex >= 0, "workflow must still invoke the classifier script");
    assert.ok(
      bootstrapIndex < classifierIndex,
      "bootstrap guard must be evaluated before the classifier script runs"
    );
  });

  it("keeps the bootstrap guard independent of the classifier script it protects", () => {
    // This is the crux of the fix: scripts/ui-quality-paths.mjs (and its transitive imports) is
    // exactly what the bootstrap guard protects, so the guard's own detection logic must not call
    // back into that script (directly, via node, or otherwise) -- otherwise a broken or
    // maliciously "fixed" classifier could hide changes to itself.
    const detectStepMatch = suiteAction.match(/name: Detect UI changes[\s\S]*?run: \|([\s\S]*?)(?=\n    - name:)/);
    assert.ok(detectStepMatch, "could not locate the Detect UI changes step body");
    const fullStepBody = detectStepMatch[0];
    const classifierIndex = fullStepBody.indexOf("node scripts/ui-quality-paths.mjs --git-diff");
    const bootstrapGuardBody = fullStepBody.slice(0, classifierIndex);

    assert.doesNotMatch(
      bootstrapGuardBody,
      /node scripts\/ui-quality-paths\.mjs/,
      "the bootstrap guard portion of the step must not invoke the classifier script"
    );
  });

  it("the workflow's bootstrap pattern matches every UI_QUALITY_BOOTSTRAP_PATHS entry", () => {
    // Proves the workflow's hand-written grep pattern (which cannot import JS modules) has not
    // drifted from the classifier's own source of truth for enforcement-infrastructure paths.
    const patternMatch = suiteAction.match(/BOOTSTRAP_PATTERN='([^']+)'/);
    assert.ok(patternMatch, "workflow must declare BOOTSTRAP_PATTERN");
    const bootstrapRegex = new RegExp(patternMatch[1]);

    for (const bootstrapPath of UI_QUALITY_BOOTSTRAP_PATHS) {
      const sample = bootstrapPath.endsWith("/") ? `${bootstrapPath}manifest.json` : bootstrapPath;
      assert.match(sample, bootstrapRegex, `workflow BOOTSTRAP_PATTERN must match ${sample}`);
    }
  });

  it("does not classify unrelated files via the bootstrap pattern (stays minimal)", () => {
    const patternMatch = suiteAction.match(/BOOTSTRAP_PATTERN='([^']+)'/);
    assert.ok(patternMatch);
    const bootstrapRegex = new RegExp(patternMatch[1]);

    for (const file of ["docs/how-we-build/testing.md", "packages/ui/src/components/ui/button.tsx", "README.md"]) {
      assert.doesNotMatch(file, bootstrapRegex, file);
    }
  });

  it("proves the enforcement layer cannot classify its own change as non-impacting", () => {
    // Simulates the exact bootstrap failure mode the review flagged: a compromised or buggy
    // scripts/ui-quality-paths.mjs that (wrongly) reports "false" for a diff touching only itself.
    // The workflow-level guard must not depend on classifyUiQualityChanges at all, so it still
    // forces ui=true regardless of what the (hypothetically broken) classifier would have said.
    const patternMatch = suiteAction.match(/BOOTSTRAP_PATTERN='([^']+)'/);
    assert.ok(patternMatch);
    const bootstrapRegex = new RegExp(patternMatch[1]);

    const selfChange = ["scripts/ui-quality-paths.mjs"];
    const brokenClassifierResult = { ui: false, impacting: [] }; // what a compromised script might return

    const bootstrapCatchesIt = selfChange.some((file) => bootstrapRegex.test(file));

    assert.equal(brokenClassifierResult.ui, false, "sanity check: the simulated broken classifier says non-impacting");
    assert.equal(bootstrapCatchesIt, true, "the workflow bootstrap guard must catch it independently");
  });
});
