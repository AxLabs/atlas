import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
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
    assert.equal(result.storyCount, 14);
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

  it("fails when a critical-stories.json ID is stale (absent from the built Storybook index)", () => {
    // Proves IDs are validated against the built artifact, not reverse-engineered: the fixture
    // storybook-static/index.json only contains "ui-select--keyboard-interaction", so a manifest
    // entry recording any other ID (e.g. after a story title/export rename regenerated the real
    // ID) must fail clearly rather than being silently accepted because the file/export still
    // resolve fine.
    const result = evaluateCriticalStoryPolicy({
      repoRoot: fixtures,
      manifestPath: path.join(fixtures, "manifest-stale-id.json"),
      exceptionsPath: path.join(fixtures, "a11y-exceptions.json"),
    });
    assert.equal(result.ok, false);
    assert.match(result.failures.join("\n"), /story ID not found in built Storybook index/);
    assert.match(result.failures.join("\n"), /ui-select--renamed-away/);
  });

  it("passes when the manifest ID exists in the built Storybook index fixture", () => {
    const result = evaluateCriticalStoryPolicy({
      repoRoot: fixtures,
      manifestPath: path.join(fixtures, "manifest-known-good.json"),
      exceptionsPath: path.join(fixtures, "a11y-exceptions.json"),
    });
    assert.equal(result.ok, true, result.failures.join("\n"));
  });

  it("fails clearly when requireStorybookIndex is set and the built index is missing", () => {
    // This is the exact mode the CLI (main()) always runs in, so CI can never silently skip
    // Storybook-ID validation just because build-storybook wasn't run first.
    const result = evaluateCriticalStoryPolicy({
      repoRoot: fixtures,
      manifestPath: path.join(fixtures, "manifest-known-good.json"),
      exceptionsPath: path.join(fixtures, "a11y-exceptions.json"),
      storybookIndexPath: path.join(fixtures, "packages/ui/storybook-static/does-not-exist.json"),
      requireStorybookIndex: true,
    });
    assert.equal(result.ok, false);
    assert.match(result.failures.join("\n"), /Built Storybook index not found/);
    assert.match(result.failures.join("\n"), /build-storybook/);
  });

  it("does not fail solely due to a missing built index when requireStorybookIndex is not set", () => {
    // Bare evaluateCriticalStoryPolicy() calls (e.g. the "passes the repository manifest" test
    // above, when exercised via `pnpm test` outside the UI Quality workflow) must stay stable even
    // when Storybook has never been built in that environment.
    const result = evaluateCriticalStoryPolicy({
      repoRoot: fixtures,
      manifestPath: path.join(fixtures, "manifest-known-good.json"),
      exceptionsPath: path.join(fixtures, "a11y-exceptions.json"),
      storybookIndexPath: path.join(fixtures, "packages/ui/storybook-static/does-not-exist.json"),
    });
    assert.equal(result.ok, true, result.failures.join("\n"));
  });

  it("fails when the built Storybook index is malformed", () => {
    const result = evaluateCriticalStoryPolicy({
      repoRoot: fixtures,
      manifestPath: path.join(fixtures, "manifest-known-good.json"),
      exceptionsPath: path.join(fixtures, "a11y-exceptions.json"),
      storybookIndexPath: path.join(fixtures, "a11y-exceptions.json"), // valid JSON, wrong shape
    });
    assert.equal(result.ok, false);
    assert.match(result.failures.join("\n"), /malformed/);
  });

  it("CLI always requires the built Storybook index (fails when it is absent)", () => {
    const result = runCli([
      "--repo-root",
      fixtures,
      "--manifest",
      path.join(fixtures, "manifest-known-good.json"),
      "--exceptions",
      path.join(fixtures, "a11y-exceptions.json"),
      "--storybook-index",
      path.join(fixtures, "packages/ui/storybook-static/does-not-exist.json"),
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stderr + result.stdout, /Built Storybook index not found/);
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

  // Issue 1: no-tests bypass prevention
  it("fails when a manifest-protected story has no-tests at story level (via built index)", () => {
    // The story source has `tags: ["critical", "no-tests"]` and the index reflects this.
    // Even though the source check passes (the story has critical), the index check must fail
    // because "no-tests" would cause the test runner to silently skip execution.
    const result = evaluateCriticalStoryPolicy({
      repoRoot: fixtures,
      manifestPath: path.join(fixtures, "manifest-no-tests-story.json"),
      exceptionsPath: path.join(fixtures, "a11y-exceptions.json"),
      storybookIndexPath: path.join(fixtures, "storybook-index-no-tests-story.json"),
    });
    assert.equal(result.ok, false);
    assert.match(
      result.failures.join("\n"),
      /"no-tests" tag in the built Storybook index/
    );
  });

  it("fails when a manifest-protected story inherits no-tests from component meta (via built index)", () => {
    // The story source has `tags: ["autodocs"]` (no "no-tests"), but the built Storybook index
    // shows "no-tests" because the component meta or global preview contributes it. The policy
    // must catch this via the index, not source text, because source text cannot see inherited tags.
    const result = evaluateCriticalStoryPolicy({
      repoRoot: fixtures,
      manifestPath: path.join(fixtures, "manifest-no-tests-inherited.json"),
      exceptionsPath: path.join(fixtures, "a11y-exceptions.json"),
      storybookIndexPath: path.join(fixtures, "storybook-index-no-tests-inherited.json"),
    });
    assert.equal(result.ok, false);
    assert.match(
      result.failures.join("\n"),
      /"no-tests" tag in the built Storybook index/
    );
  });
});
