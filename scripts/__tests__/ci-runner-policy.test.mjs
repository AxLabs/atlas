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
  TRUSTED_WORKFLOW_ALLOWLIST,
  aggregateRequiredCheckResults,
  callersUseTrustedWorkflow,
  selectBundleExecutionPath,
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
      - uses: ./.github/actions/setup-ci-node
      - uses: ./.github/actions/run-ci-suite
        if: inputs.suite == 'ci'
      - uses: ./.github/actions/run-ui-quality-suite
        if: inputs.suite == 'ui-quality'
      - uses: ./.github/actions/run-bundle-analysis-suite
        if: inputs.suite == 'bundle'
      - uses: ./.github/actions/cleanup-self-hosted-job
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
    permissions:
      contents: read
      pull-requests: write
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

const phase2Ui = `name: UI Quality
on: push
env:
  ATLAS_CI_RUNNER_PROFILE: \${{ vars.ATLAS_CI_RUNNER_PROFILE || 'github-hosted' }}
  ATLAS_CI_USE_SELF_HOSTED:
    \${{ vars.ATLAS_CI_RUNNER_PROFILE == 'self-hosted' && (github.event_name != 'pull_request' ||
    github.event.pull_request.head.repo.full_name == github.repository) }}
permissions:
  contents: read
jobs:
  detect:
    name: Detect UI changes
    runs-on: ubuntu-latest
    timeout-minutes: 5
    outputs:
      ui: true
    steps:
      - run: echo detect
  ui-quality-hosted:
    name: UI Quality (hosted)
    needs: detect
    if: |
      needs.detect.outputs.ui == 'true' &&
      (vars.ATLAS_CI_RUNNER_PROFILE != 'self-hosted' ||
      (github.event_name == 'pull_request' &&
      github.event.pull_request.head.repo.full_name != github.repository))
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - run: echo hosted
  ui-quality-trusted:
    name: UI Quality (trusted)
    needs: detect
    if: |
      needs.detect.outputs.ui == 'true' &&
      vars.ATLAS_CI_RUNNER_PROFILE == 'self-hosted' &&
      (github.event_name != 'pull_request' ||
      github.event.pull_request.head.repo.full_name == github.repository)
    permissions:
      contents: read
      pull-requests: write
    uses: ${TRUSTED_WORKFLOW_USES}
    with:
      suite: ui-quality
  ui-quality:
    name: UI Quality
    needs: [detect, ui-quality-hosted, ui-quality-trusted]
    if: always()
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - run: |
          hosted="\${{ needs.ui-quality-hosted.result }}"
          trusted="\${{ needs.ui-quality-trusted.result }}"
          if { [ "$hosted" = success ] && [ "$trusted" = skipped ]; } || \\
             { [ "$hosted" = skipped ] && [ "$trusted" = success ]; }; then
            exit 0
          fi
          exit 1
`;

const phase2BundleHosted = `name: Bundle Analysis
on: push
permissions:
  contents: read
  pull-requests: write
jobs:
  detect:
    name: Detect bundle changes
    runs-on: ubuntu-latest
    timeout-minutes: 5
    outputs:
      bundle: true
    steps:
      - run: echo detect
  bundle-hosted:
    name: Bundle Analysis (hosted)
    needs: detect
    if: needs.detect.outputs.bundle == 'true'
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - run: echo hosted
  bundle:
    name: Bundle Analysis
    needs: [detect, bundle-hosted]
    if: always()
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - run: echo hosted
`;

function writePhase2Callers(root, { ci = phase2Caller, ui, bundle } = {}) {
  writeWorkflow(root, TRUSTED_SELF_HOSTED_WORKFLOW, trustedWorkflow);
  writeWorkflow(root, ".github/workflows/ci.yml", ci);
  writeWorkflow(root, ".github/workflows/ui-quality.yml", ui ?? phase2Ui);
  writeWorkflow(root, ".github/workflows/perf-bundle.yml", bundle ?? phase2BundleHosted);
}

describe("CI runner policy", () => {
  it("uses Blitzcraft Trusted CI as the canonical runner group", () => {
    assert.equal(DEFAULT_RUNNER_GROUP, "Blitzcraft Trusted CI");
    const trusted = readFileSync(path.join(repoRoot, TRUSTED_SELF_HOSTED_WORKFLOW), "utf8");
    assert.ok(
      trusted.includes("group: ${{ vars.ATLAS_CI_RUNNER_GROUP || 'Blitzcraft Trusted CI' }}")
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

    for (const relativePath of [".github/workflows/ci.yml", ".github/workflows/ui-quality.yml"]) {
      const content = readFileSync(path.join(repoRoot, relativePath), "utf8");
      assert.equal(targetsTrustedRunnerGroup(content), false, relativePath);
      assert.equal(targetsLegacySelfHostedLabels(content), false, relativePath);
      assert.doesNotMatch(content, /\[self-hosted,\s*ci\]/);
      assert.match(content, new RegExp(TRUSTED_WORKFLOW_USES.replaceAll(".", "\\.")));
      assert.doesNotMatch(content, /secrets:\s*inherit/);
      assert.doesNotMatch(content, /runner_group:/);
      assert.doesNotMatch(content, /turing-ci-[0-9]+/);
    }

    const bundle = readFileSync(path.join(repoRoot, ".github/workflows/perf-bundle.yml"), "utf8");
    assert.equal(targetsTrustedRunnerGroup(bundle), false);
    assert.equal(targetsLegacySelfHostedLabels(bundle), false);
    assert.doesNotMatch(bundle, /trusted-self-hosted\.yml/);
    assert.doesNotMatch(bundle, /bundle-trusted/);
    assert.doesNotMatch(bundle, /turing-ci-[0-9]+/);
  });

  it("rejects runner_group input in the trusted workflow", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "atlas-ci-policy-"));
    writeWorkflow(
      root,
      TRUSTED_SELF_HOSTED_WORKFLOW,
      trustedWorkflow.replace(
        "suite:\n        type: string\n        required: true",
        "suite:\n        type: string\n        required: true\n      runner_group:\n        type: string"
      )
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
      legacyCiWorkflow
        .replace('fromJSON(\'["self-hosted", "ci"]\')', `'${DEFAULT_RUNNER_GROUP}'`)
        .replace(
          "runs-on:",
          `runs-on:\n      group: ${DEFAULT_RUNNER_GROUP}\n      labels: ci\n    legacy-runs-on:`
        )
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

  it("uses @main for reusable-workflow callers and keeps the allowlist on refs/heads/main", () => {
    assert.equal(TRUSTED_WORKFLOW_PIN, "trusted-self-hosted.yml@main");
    assert.equal(
      TRUSTED_WORKFLOW_USES,
      "blitzcraftlabs/atlas/.github/workflows/trusted-self-hosted.yml@main"
    );
    assert.equal(
      TRUSTED_WORKFLOW_ALLOWLIST,
      "blitzcraftlabs/atlas/.github/workflows/trusted-self-hosted.yml@refs/heads/main"
    );
  });

  it("rejects incorrect reusable-workflow caller refs in Phase 2", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "atlas-ci-policy-"));
    writePhase2Callers(root, {
      ci: phase2Caller.replace(TRUSTED_WORKFLOW_PIN, "trusted-self-hosted.yml@refs/heads/main"),
    });

    const errors = validateCiRunnerPolicy(root);
    assert.match(
      errors.join("\n"),
      /must be pinned to blitzcraftlabs\/atlas\/\.github\/workflows\/trusted-self-hosted\.yml@main/
    );
  });

  it("rejects mutable trusted workflow pins in Phase 2", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "atlas-ci-policy-"));
    writePhase2Callers(root, {
      ci: phase2Caller.replace(TRUSTED_WORKFLOW_PIN, "trusted-self-hosted.yml@master"),
    });

    const errors = validateCiRunnerPolicy(root);
    assert.match(
      errors.join("\n"),
      /must be pinned to blitzcraftlabs\/atlas\/\.github\/workflows\/trusted-self-hosted\.yml@main/
    );
  });

  it("rejects secrets inherit, caller runner group, and caller timeout on trusted jobs", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "atlas-ci-policy-"));
    const badCaller = phase2Caller.replace(
      "    with:\n      suite: ci\n",
      "    timeout-minutes: 90\n    secrets: inherit\n    with:\n      suite: ci\n      runner_group: extra\n"
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
      { hosted: false, trusted: true }
    );
    assert.deepEqual(
      selectCiExecutionPath({
        profile: "self-hosted",
        eventName: "push",
        headRepo: "blitzcraftlabs/atlas",
        repository: "blitzcraftlabs/atlas",
      }),
      { hosted: false, trusted: true }
    );
    assert.deepEqual(
      selectCiExecutionPath({
        profile: "github-hosted",
        eventName: "pull_request",
        headRepo: "blitzcraftlabs/atlas",
        repository: "blitzcraftlabs/atlas",
      }),
      { hosted: true, trusted: false }
    );
    assert.deepEqual(
      selectCiExecutionPath({
        profile: "github-hosted",
        eventName: "push",
        headRepo: "blitzcraftlabs/atlas",
        repository: "blitzcraftlabs/atlas",
      }),
      { hosted: true, trusted: false }
    );
    assert.deepEqual(selectBundleExecutionPath(), { hosted: true, trusted: false });
  });

  it("keeps stable aggregator names and fail-closed required-check results", () => {
    for (const relativePath of [".github/workflows/ci.yml", ".github/workflows/ui-quality.yml"]) {
      const content = readFileSync(path.join(repoRoot, relativePath), "utf8");
      assert.match(content, /if: always\(\)/);
      assert.match(content, /\[ "\$hosted" = success \] && \[ "\$trusted" = skipped \]/);
      assert.match(content, /\[ "\$hosted" = skipped \] && \[ "\$trusted" = success \]/);
    }

    const bundle = readFileSync(path.join(repoRoot, ".github/workflows/perf-bundle.yml"), "utf8");
    assert.match(bundle, /if: always\(\)/);
    assert.match(bundle, /needs: \[detect, bundle-hosted\]/);
    assert.doesNotMatch(bundle, /bundle-trusted/);

    assert.equal(aggregateRequiredCheckResults("success", "skipped"), "success");
    assert.equal(aggregateRequiredCheckResults("skipped", "success"), "success");
    assert.equal(aggregateRequiredCheckResults("failure", "skipped"), "failure");
    assert.equal(aggregateRequiredCheckResults("skipped", "failure"), "failure");
    assert.equal(aggregateRequiredCheckResults("cancelled", "skipped"), "failure");
    assert.equal(aggregateRequiredCheckResults("skipped", "skipped"), "failure");
  });

  it("checks out trusted work into github.workspace like hosted runners", () => {
    const trusted = readFileSync(path.join(repoRoot, TRUSTED_SELF_HOSTED_WORKFLOW), "utf8");
    const ciAction = readFileSync(
      path.join(repoRoot, ".github/actions/run-ci-suite/action.yml"),
      "utf8"
    );
    const uiAction = readFileSync(
      path.join(repoRoot, ".github/actions/run-ui-quality-suite/action.yml"),
      "utf8"
    );
    const bundleAction = readFileSync(
      path.join(repoRoot, ".github/actions/run-bundle-analysis-suite/action.yml"),
      "utf8"
    );
    const setupCiNode = readFileSync(
      path.join(repoRoot, ".github/actions/setup-ci-node/action.yml"),
      "utf8"
    );
    const setupAtlasCi = readFileSync(
      path.join(repoRoot, ".github/actions/setup-atlas-ci/action.yml"),
      "utf8"
    );

    assert.doesNotMatch(trusted, /CI_CHECKOUT_DIR:/);
    assert.doesNotMatch(trusted, /uses:\s*\.\/ci-link-/);
    assert.doesNotMatch(trusted, /^\s+path:/m);
    assert.match(trusted, /uses: \.\/\.github\/actions\/setup-ci-node/);
    assert.match(trusted, /uses: \.\/\.github\/actions\/run-ci-suite/);
    assert.match(trusted, /runner-profile: self-hosted/);
    assert.match(trusted, /PNPM_STORE_DIR|setup-ci-node/);

    for (const [label, content] of [
      ["run-ci-suite", ciAction],
      ["run-ui-quality-suite", uiAction],
      ["run-bundle-analysis-suite", bundleAction],
    ]) {
      assert.doesNotMatch(content, /checkout-dir:/, label);
      assert.doesNotMatch(content, /inputs\.checkout-dir/, label);
    }

    assert.match(ciAction, /node scripts\/ci-change-paths\.mjs --git-diff/);
    assert.match(ciAction, /pnpm test:coverage:all/);
    assert.match(ciAction, /pnpm test:boundaries/);
    assert.doesNotMatch(ciAction, /^\s+run: pnpm test$/m);
    assert.match(ciAction, /\.\/packages\/ui\/coverage\/coverage-final\.json/);
    assert.match(ciAction, /\.\/apps\/web\/coverage\/coverage-final\.json/);
    assert.match(ciAction, /-w "\$\{GITHUB_WORKSPACE\}"/);
    assert.match(
      ciAction,
      /corepack pnpm --filter @atlas\/web test:e2e & w=\$!; corepack pnpm --filter @atlas\/reference test:e2e & r=\$!; wait "\$w"; web_ec=\$\?; wait "\$r"; ref_ec=\$\?; exit \$\(\(web_ec \|\| ref_ec\)\)/
    );
    assert.match(
      ciAction,
      /else\s+pnpm --filter @atlas\/web test:e2e\s+pnpm --filter @atlas\/reference test:e2e/
    );

    const referencePlaywright = readFileSync(
      path.join(repoRoot, "apps/reference/playwright.config.ts"),
      "utf8"
    );
    assert.match(referencePlaywright, /fullyParallel:\s*false/);
    assert.match(referencePlaywright, /workers:\s*process\.env\.CI \? 2 : 1/);
    assert.match(referencePlaywright, /retries:\s*process\.env\.CI \? 2 : 0/);
    assert.match(referencePlaywright, /failOnFlakyTests:\s*Boolean\(process\.env\.CI\)/);
    assert.match(referencePlaywright, /name:\s*"chromium"/);
    assert.match(referencePlaywright, /name:\s*"webkit"/);
    assert.match(uiAction, /packages\/ui\/test-results\//);
    assert.match(uiAction, /-w "\$\{GITHUB_WORKSPACE\}"/);
    assert.match(uiAction, /inputs\.runner-profile != 'self-hosted'/);
    assert.match(
      uiAction,
      /corepack enable --install-directory "\$HOME\/bin" pnpm && export PATH="\$HOME\/bin:\$PATH" && pnpm --filter @atlas\/ui test:storybook && pnpm --filter @atlas\/ui test:storybook:cross-browser'/
    );
    assert.match(
      uiAction,
      /corepack enable --install-directory "\$HOME\/bin" pnpm && export PATH="\$HOME\/bin:\$PATH" && pnpm --filter @atlas\/ui test:visual'/
    );
    assert.match(uiAction, /mcr\.microsoft\.com\/playwright:v\$\{pw_version\}-noble/);
    assert.doesNotMatch(uiAction, /else\s+pnpm --filter @atlas\/ui test:visual/);
    assert.match(setupCiNode, /package-manager-cache:\s*false/);
    assert.match(setupAtlasCi, /package-manager-cache:\s*false/);
    assert.match(setupAtlasCi, /cache:\s*pnpm/);
    assert.match(bundleAction, /node scripts\/bundle-paths\.mjs --git-diff/);
    assert.match(bundleAction, /path: apps\/web\/\.next\/bundle-baseline\.json/);
  });
});
