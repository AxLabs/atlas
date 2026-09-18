import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  DEFAULT_RUNNER_GROUP,
  TRUSTED_SELF_HOSTED_WORKFLOW,
  TRUSTED_WORKFLOW_PIN,
  callersUseTrustedWorkflow,
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
    if: env.ATLAS_CI_USE_SELF_HOSTED != 'true'
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - run: echo hosted
  ci-trusted:
    if: env.ATLAS_CI_USE_SELF_HOSTED == 'true'
    uses: blitzcraftlabs/atlas/${TRUSTED_WORKFLOW_PIN}
    with:
      suite: ci
  ci:
    name: CI
    needs: [ci-hosted, ci-trusted]
    if: always()
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - run: echo aggregate
`;

describe("CI runner policy", () => {
  it("passes the current repository Phase-1 policy", () => {
    const errors = validateCiRunnerPolicyPhase1(repoRoot);
    assert.deepEqual(errors, []);
  });

  it("passes full workflow validation including actionlint policy", () => {
    const errors = validateGithubWorkflows(repoRoot);
    assert.deepEqual(errors, []);
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
        "'Blitzcraft OSS Trusted'",
      ).replace(
        "runs-on:",
        "runs-on:\n      group: Blitzcraft OSS Trusted\n      labels: ci\n    legacy-runs-on:",
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
    writeWorkflow(root, TRUSTED_SELF_HOSTED_WORKFLOW, trustedWorkflow);
    writeWorkflow(root, ".github/workflows/ci.yml", phase2Caller);
    writeWorkflow(root, ".github/workflows/ui-quality.yml", phase2Caller);
    writeWorkflow(root, ".github/workflows/perf-bundle.yml", phase2Caller);

    const errors = validateCiRunnerPolicyPhase1(root);
    assert.match(errors.join("\n"), /Phase-2 trusted caller migration must not ship/);
    assert.equal(callersUseTrustedWorkflow(root), true);
  });

  it("enforces Phase-2 caller rules when trusted workflow is referenced", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "atlas-ci-policy-"));
    writeWorkflow(root, TRUSTED_SELF_HOSTED_WORKFLOW, trustedWorkflow);
    writeWorkflow(root, ".github/workflows/ci.yml", phase2Caller);
    writeWorkflow(
      root,
      ".github/workflows/ui-quality.yml",
      phase2Caller
        .replaceAll("CI (hosted)", "UI Quality (hosted)")
        .replaceAll("name: CI\n", "name: UI Quality\n")
        .replaceAll("suite: ci", "suite: ui-quality"),
    );
    writeWorkflow(
      root,
      ".github/workflows/perf-bundle.yml",
      phase2Caller
        .replaceAll("CI (hosted)", "Bundle Analysis (hosted)")
        .replaceAll("name: CI\n", "name: Bundle Analysis\n")
        .replaceAll("suite: ci", "suite: bundle"),
    );

    const errors = validateCiRunnerPolicy(root);
    assert.deepEqual(errors, []);
  });

  it("rejects mutable trusted workflow pins in Phase 2", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "atlas-ci-policy-"));
    writeWorkflow(root, TRUSTED_SELF_HOSTED_WORKFLOW, trustedWorkflow);
    writeWorkflow(
      root,
      ".github/workflows/ci.yml",
      phase2Caller.replace(TRUSTED_WORKFLOW_PIN, "trusted-self-hosted.yml@main"),
    );
    writeWorkflow(root, ".github/workflows/ui-quality.yml", phase2Caller);
    writeWorkflow(root, ".github/workflows/perf-bundle.yml", phase2Caller);

    const errors = validateCiRunnerPolicy(root);
    assert.match(errors.join("\n"), /must be pinned to trusted-self-hosted\.yml@refs\/heads\/main/);
  });
});
