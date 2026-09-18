import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  DEFAULT_RUNNER_GROUP,
  TRUSTED_SELF_HOSTED_WORKFLOW,
  TRUSTED_WORKFLOW_PIN,
  TRUSTED_WORKFLOW_USES,
  aggregateRequiredCheckResults,
  callersUseTrustedWorkflow,
  resolveIsolatedWorkspacePath,
  selectCiExecutionPath,
  targetsLegacySelfHostedLabels,
  targetsTrustedRunnerGroup,
  validateCiRunnerPolicy,
  validateCiRunnerPolicyPhase1,
  validateGithubWorkflows,
} from "../validate-github-workflows.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function writeWorkflow(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

const trustedWorkflow = `name: Trusted Self-Hosted CI
on:
  workflow_call:
    inputs:
      suite:
        type: string
        required: true
jobs:
  execute:
    if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository
    runs-on:
      group: \${{ vars.ATLAS_CI_RUNNER_GROUP || '${DEFAULT_RUNNER_GROUP}' }}
      labels: ci
    timeout-minutes: 90
    steps:
      - run: |
          case "\${{ inputs.suite }}" in
            ci|ui-quality|bundle) ;;
            *) exit 1 ;;
          esac
      - uses: ./ci-link-ci/.github/actions/run-ci-suite
        if: inputs.suite == 'ci'
`;

const legacyCiWorkflow = `name: CI
on: push
env:
  ATLAS_CI_RUNNER_PROFILE: \${{ vars.ATLAS_CI_RUNNER_PROFILE || 'github-hosted' }}
permissions:
  contents: read
jobs:
  ci:
    name: CI
    runs-on:
      \${{ vars.ATLAS_CI_RUNNER_PROFILE == 'self-hosted' && fromJSON('["self-hosted", "ci"]') || 'ubuntu-latest' }}
    timeout-minutes: 90
    steps:
      - run: echo hosted
`;

const aggregatorStep = `    steps:
      - run: |
          hosted="\${{ needs.ci-hosted.result }}"
          trusted="\${{ needs.ci-trusted.result }}"
          if { [ "$hosted" = success ] && [ "$trusted" = skipped ]; } || \\
             { [ "$hosted" = skipped ] && [ "$trusted" = success ]; }; then
            exit 0
          fi
          exit 1
`;

const phase2Caller = `name: CI
on: push
env:
  ATLAS_CI_RUNNER_PROFILE: \${{ vars.ATLAS_CI_RUNNER_PROFILE || 'github-hosted' }}
  ATLAS_CI_USE_SELF_HOSTED:
    \${{ vars.ATLAS_CI_RUNNER_PROFILE == 'self-hosted' && (github.event_name != 'pull_request' ||
    github.event.pull_request.head.repo.full_name == github.repository) }}
permissions:
  contents: read
jobs:
  ci-hosted:
    name: CI (hosted)
    if: |
      vars.ATLAS_CI_RUNNER_PROFILE != 'self-hosted' ||
      (github.event_name == 'pull_request' &&
      github.event.pull_request.head.repo.full_name != github.repository)
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - run: echo hosted
  ci-trusted:
    name: CI (trusted)
    if: |
      vars.ATLAS_CI_RUNNER_PROFILE == 'self-hosted' &&
      (github.event_name != 'pull_request' ||
      github.event.pull_request.head.repo.full_name == github.repository)
    uses: ${TRUSTED_WORKFLOW_USES}
    with:
      suite: ci
  ci:
    name: CI
    needs: [ci-hosted, ci-trusted]
    if: always()
    runs-on: ubuntu-latest
    timeout-minutes: 5
${aggregatorStep}`;

function writePhase2Callers(root, { ci = phase2Caller, ui, bundle } = {}) {
  writeWorkflow(root, TRUSTED_SELF_HOSTED_WORKFLOW, trustedWorkflow);
  writeWorkflow(root, ".github/workflows/ci.yml", ci);
  writeWorkflow(
    root,
    ".github/workflows/ui-quality.yml",
    ui ??
      phase2Caller
        .replaceAll("CI (hosted)", "UI Quality (hosted)")
        .replaceAll("CI (trusted)", "UI Quality (trusted)")
        .replaceAll("name: CI\n", "name: UI Quality\n")
        .replaceAll("suite: ci", "suite: ui-quality")
        .replaceAll("ci-hosted", "ui-quality-hosted")
        .replaceAll("ci-trusted", "ui-quality-trusted"),
  );
  writeWorkflow(
    root,
    ".github/workflows/perf-bundle.yml",
    bundle ??
      phase2Caller
        .replaceAll("CI (hosted)", "Bundle Analysis (hosted)")
        .replaceAll("CI (trusted)", "Bundle Analysis (trusted)")
        .replaceAll("name: CI\n", "name: Bundle Analysis\n")
        .replaceAll("suite: ci", "suite: bundle")
        .replaceAll("ci-hosted", "bundle-hosted")
        .replaceAll("ci-trusted", "bundle-trusted"),
  );
}

describe("CI runner policy", () => {
  it("uses Blitzcraft Trusted CI as the canonical runner group", () => {
    assert.equal(DEFAULT_RUNNER_GROUP, "Blitzcraft Trusted CI");
    const trusted = readFileSync(path.join(repoRoot, TRUSTED_SELF_HOSTED_WORKFLOW), "utf8");
    assert.ok(
      trusted.includes("group: ${{ vars.ATLAS_CI_RUNNER_GROUP || 'Blitzcraft Trusted CI' }}"),
    );
  });

  it("passes the current repository Phase-2 policy", () => {
    const errors = validateCiRunnerPolicy(repoRoot);
    assert.deepEqual(errors, []);
  });

  it("passes full workflow validation including actionlint policy", () => {
    const errors = validateGithubWorkflows(repoRoot);
    assert.deepEqual(errors, []);
  });

  it("keeps only the trusted workflow as a runner-group target", () => {
    const trusted = readFileSync(path.join(repoRoot, TRUSTED_SELF_HOSTED_WORKFLOW), "utf8");
    assert.equal(targetsTrustedRunnerGroup(trusted), true);

    for (const relativePath of [
      ".github/workflows/ci.yml",
      ".github/workflows/ui-quality.yml",
      ".github/workflows/perf-bundle.yml",
    ]) {
      const content = readFileSync(path.join(repoRoot, relativePath), "utf8");
      assert.equal(targetsTrustedRunnerGroup(content), false, relativePath);
      assert.equal(targetsLegacySelfHostedLabels(content), false, relativePath);
      assert.doesNotMatch(content, /\[self-hosted,\s*ci\]/);
      assert.match(content, new RegExp(TRUSTED_WORKFLOW_USES.replaceAll(".", "\\.")));
      assert.doesNotMatch(content, /secrets:\s*inherit/);
      assert.doesNotMatch(content, /runner_group:/);
      assert.doesNotMatch(content, /turing-ci-[0-9]+/);
    }
  });

  it("rejects runner_group input in the trusted workflow", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "atlas-ci-policy-"));
    writeWorkflow(
      root,
      TRUSTED_SELF_HOSTED_WORKFLOW,
      trustedWorkflow.replace(
        "suite:\n        type: string\n        required: true",
        "suite:\n        type: string\n        required: true\n      runner_group:\n        type: string",
      ),
    );
    writeWorkflow(root, ".github/workflows/ci.yml", legacyCiWorkflow);

    const errors = validateCiRunnerPolicyPhase1(root);
    assert.match(errors.join("\n"), /must not accept runner_group from callers/);
  });

  it("rejects runner-group targeting outside the trusted workflow", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "atlas-ci-policy-"));
    writeWorkflow(root, TRUSTED_SELF_HOSTED_WORKFLOW, trustedWorkflow);
    writeWorkflow(
      root,
      ".github/workflows/ci.yml",
      legacyCiWorkflow.replace(
        "fromJSON('[\"self-hosted\", \"ci\"]')",
        `'${DEFAULT_RUNNER_GROUP}'`,
      ).replace(
        "runs-on:",
        `runs-on:\n      group: ${DEFAULT_RUNNER_GROUP}\n      labels: ci\n    legacy-runs-on:`,
      ),
    );

    const errors = validateCiRunnerPolicyPhase1(root);
    assert.match(errors.join("\n"), /may target trusted self-hosted runner groups/);
  });

  it("allows legacy self-hosted labels in Phase 1 callers", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "atlas-ci-policy-"));
    writeWorkflow(root, TRUSTED_SELF_HOSTED_WORKFLOW, trustedWorkflow);
    writeWorkflow(root, ".github/workflows/ci.yml", legacyCiWorkflow);

    const errors = validateCiRunnerPolicyPhase1(root);
    assert.deepEqual(errors, []);
    assert.equal(targetsLegacySelfHostedLabels(legacyCiWorkflow), true);
    assert.equal(targetsTrustedRunnerGroup(legacyCiWorkflow), false);
  });

  it("rejects Phase-2 callers before trusted workflow exists on main", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "atlas-ci-policy-"));
    writePhase2Callers(root);

    const errors = validateCiRunnerPolicyPhase1(root);
    assert.match(errors.join("\n"), /Phase-2 trusted caller migration must not ship/);
    assert.equal(callersUseTrustedWorkflow(root), true);
  });

  it("enforces Phase-2 caller rules when trusted workflow is referenced", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "atlas-ci-policy-"));
    writePhase2Callers(root);

    const errors = validateCiRunnerPolicy(root);
    assert.deepEqual(errors, []);
  });

  it("rejects mutable trusted workflow pins in Phase 2", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "atlas-ci-policy-"));
    writePhase2Callers(root, {
      ci: phase2Caller.replace(TRUSTED_WORKFLOW_PIN, "trusted-self-hosted.yml@main"),
    });

    const errors = validateCiRunnerPolicy(root);
    assert.match(errors.join("\n"), /must be pinned to blitzcraftlabs\/atlas\/\.github\/workflows\/trusted-self-hosted\.yml@refs\/heads\/main/);
  });

  it("rejects secrets inherit, caller runner group, and caller timeout on trusted jobs", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "atlas-ci-policy-"));
    const badCaller = phase2Caller.replace(
      "    with:\n      suite: ci\n",
      "    timeout-minutes: 90\n    secrets: inherit\n    with:\n      suite: ci\n      runner_group: extra\n",
    );
    writePhase2Callers(root, { ci: badCaller });

    const errors = validateCiRunnerPolicy(root).join("\n");
    assert.match(errors, /must not set timeout-minutes/);
    assert.match(errors, /must not use secrets: inherit/);
    assert.match(errors, /must not pass runner_group/);
  });

  it("routes fork PRs to hosted even when the profile is self-hosted", () => {
    const forkSelfHosted = selectCiExecutionPath({
      profile: "self-hosted",
      eventName: "pull_request",
      headRepo: "external/atlas",
      repository: "blitzcraftlabs/atlas",
    });
    assert.deepEqual(forkSelfHosted, { hosted: true, trusted: false });

    const forkHosted = selectCiExecutionPath({
      profile: "github-hosted",
      eventName: "pull_request",
      headRepo: "external/atlas",
      repository: "blitzcraftlabs/atlas",
    });
    assert.deepEqual(forkHosted, { hosted: true, trusted: false });
  });

  it("routes same-repo self-hosted work to trusted with no hosted fallback", () => {
    assert.deepEqual(
      selectCiExecutionPath({
        profile: "self-hosted",
        eventName: "pull_request",
        headRepo: "blitzcraftlabs/atlas",
        repository: "blitzcraftlabs/atlas",
      }),
      { hosted: false, trusted: true },
    );
    assert.deepEqual(
      selectCiExecutionPath({
        profile: "self-hosted",
        eventName: "push",
        headRepo: "blitzcraftlabs/atlas",
        repository: "blitzcraftlabs/atlas",
      }),
      { hosted: false, trusted: true },
    );
    assert.deepEqual(
      selectCiExecutionPath({
        profile: "github-hosted",
        eventName: "pull_request",
        headRepo: "blitzcraftlabs/atlas",
        repository: "blitzcraftlabs/atlas",
      }),
      { hosted: true, trusted: false },
    );
    assert.deepEqual(
      selectCiExecutionPath({
        profile: "github-hosted",
        eventName: "push",
        headRepo: "blitzcraftlabs/atlas",
        repository: "blitzcraftlabs/atlas",
      }),
      { hosted: true, trusted: false },
    );
  });

  it("keeps stable aggregator names and fail-closed required-check results", () => {
    for (const relativePath of [
      ".github/workflows/ci.yml",
      ".github/workflows/ui-quality.yml",
      ".github/workflows/perf-bundle.yml",
    ]) {
      const content = readFileSync(path.join(repoRoot, relativePath), "utf8");
      assert.match(content, /if: always\(\)/);
      assert.match(content, /\[ "\$hosted" = success \] && \[ "\$trusted" = skipped \]/);
      assert.match(content, /\[ "\$hosted" = skipped \] && \[ "\$trusted" = success \]/);
    }

    assert.equal(aggregateRequiredCheckResults("success", "skipped"), "success");
    assert.equal(aggregateRequiredCheckResults("skipped", "success"), "success");
    assert.equal(aggregateRequiredCheckResults("failure", "skipped"), "failure");
    assert.equal(aggregateRequiredCheckResults("skipped", "failure"), "failure");
    assert.equal(aggregateRequiredCheckResults("cancelled", "skipped"), "failure");
    assert.equal(aggregateRequiredCheckResults("skipped", "skipped"), "failure");
  });

  it("prefixes isolated-workspace paths for GitHub actions on the trusted profile", () => {
    assert.equal(
      resolveIsolatedWorkspacePath("packages/ui/test-results/", {
        runnerProfile: "github-hosted",
        checkoutDir: "ui-ws-r1",
      }),
      "packages/ui/test-results/",
    );
    assert.equal(
      resolveIsolatedWorkspacePath("packages/ui/test-results/", {
        runnerProfile: "self-hosted",
        checkoutDir: "ui-ws-r1",
      }),
      "ui-ws-r1/packages/ui/test-results/",
    );
    assert.equal(
      resolveIsolatedWorkspacePath("apps/web/.next/bundle-baseline.json", {
        runnerProfile: "self-hosted",
        checkoutDir: "bundle-ws-r1",
      }),
      "bundle-ws-r1/apps/web/.next/bundle-baseline.json",
    );

    const uiAction = readFileSync(
      path.join(repoRoot, ".github/actions/run-ui-quality-suite/action.yml"),
      "utf8",
    );
    const bundleAction = readFileSync(
      path.join(repoRoot, ".github/actions/run-bundle-analysis-suite/action.yml"),
      "utf8",
    );
    const trusted = readFileSync(path.join(repoRoot, TRUSTED_SELF_HOSTED_WORKFLOW), "utf8");

    assert.match(uiAction, /format\('\{0\}\/packages\/ui\/test-results\/', inputs\.checkout-dir\)/);
    assert.match(
      bundleAction,
      /format\('\{0\}\/apps\/web\/\.next\/bundle-baseline\.json', inputs\.checkout-dir\)/,
    );
    assert.ok(trusted.includes("checkout-dir: ${{ env.CI_CHECKOUT_DIR }}"));
    assert.match(trusted, /runner-profile: self-hosted/);
  });
});
