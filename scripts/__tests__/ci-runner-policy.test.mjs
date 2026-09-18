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
  targetsTrustedRunnerInfrastructure,
  validateCiRunnerPolicy,
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
      runner_group:
        type: string
        default: ${DEFAULT_RUNNER_GROUP}
jobs:
  execute:
    if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository
    runs-on:
      group: \${{ inputs.runner_group }}
      labels: ci
    steps:
      - run: echo trusted
`;

const callerWorkflow = `name: CI
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
    name: CI
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
      runner_group: \${{ vars.ATLAS_CI_RUNNER_GROUP || '${DEFAULT_RUNNER_GROUP}' }}
      check_name: CI
`;

describe("CI runner policy", () => {
  it("passes the current repository policy", () => {
    const errors = validateCiRunnerPolicy(repoRoot);
    assert.deepEqual(errors, []);
  });

  it("passes full workflow validation including runner policy", () => {
    const errors = validateGithubWorkflows(repoRoot);
    assert.deepEqual(errors, []);
  });

  it("detects direct self-hosted targeting outside the trusted workflow", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "atlas-ci-policy-"));
    writeWorkflow(root, TRUSTED_SELF_HOSTED_WORKFLOW, trustedWorkflow);
    writeWorkflow(
      root,
      ".github/workflows/ci.yml",
      `${callerWorkflow.replace("runs-on: ubuntu-latest", "runs-on: [self-hosted, ci]")}`
    );

    const errors = validateCiRunnerPolicy(root);
    assert.match(
      errors.join("\n"),
      /only \.github\/workflows\/trusted-self-hosted\.yml may target trusted self-hosted runner infrastructure/
    );
  });

  it("detects missing fork trust gate in the trusted workflow", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "atlas-ci-policy-"));
    writeWorkflow(
      root,
      TRUSTED_SELF_HOSTED_WORKFLOW,
      trustedWorkflow.replace(
        "github.event.pull_request.head.repo.full_name == github.repository",
        "github.repository != ''"
      )
    );
    writeWorkflow(root, ".github/workflows/ci.yml", callerWorkflow);

    const errors = validateCiRunnerPolicy(root);
    assert.match(
      errors.join("\n"),
      /must gate execution on github\.event\.pull_request\.head\.repo\.full_name/
    );
  });

  it("detects mutable trusted workflow pins", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "atlas-ci-policy-"));
    writeWorkflow(root, TRUSTED_SELF_HOSTED_WORKFLOW, trustedWorkflow);
    writeWorkflow(
      root,
      ".github/workflows/ci.yml",
      callerWorkflow.replace(TRUSTED_WORKFLOW_PIN, "trusted-self-hosted.yml@main")
    );
    writeWorkflow(
      root,
      ".github/workflows/ui-quality.yml",
      callerWorkflow.replace("suite: ci", "suite: ui-quality")
    );
    writeWorkflow(
      root,
      ".github/workflows/perf-bundle.yml",
      callerWorkflow.replace("suite: ci", "suite: bundle")
    );

    const errors = validateCiRunnerPolicy(root);
    assert.match(errors.join("\n"), /must be pinned to trusted-self-hosted\.yml@refs\/heads\/main/);
  });

  it("detects missing GitHub-hosted fallback jobs", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "atlas-ci-policy-"));
    writeWorkflow(root, TRUSTED_SELF_HOSTED_WORKFLOW, trustedWorkflow);
    writeWorkflow(
      root,
      ".github/workflows/ci.yml",
      callerWorkflow.replace("runs-on: ubuntu-latest", "runs-on: macos-latest")
    );
    writeWorkflow(root, ".github/workflows/ui-quality.yml", callerWorkflow);
    writeWorkflow(root, ".github/workflows/perf-bundle.yml", callerWorkflow);

    const errors = validateCiRunnerPolicy(root);
    assert.match(errors.join("\n"), /must keep a GitHub-hosted runs-on fallback path/);
  });

  it("flags runner-group targeting helpers", () => {
    assert.equal(
      targetsTrustedRunnerInfrastructure("runs-on:\n  group: Blitzcraft OSS Trusted\n  labels: ci"),
      true
    );
    assert.equal(targetsTrustedRunnerInfrastructure("runs-on: ubuntu-latest"), false);
  });
});
