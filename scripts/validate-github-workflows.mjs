#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_REPO_ROOT, loadPolicy } from "./security-audit-policy.mjs";
import { runActionlint } from "./run-actionlint.mjs";

const scriptPath = fileURLToPath(import.meta.url);

const REQUIRED_DOCUMENTS = [
  "SECURITY.md",
  "docs/security/threat-model.md",
  "docs/how-we-build/security.md",
  "security/policy.json",
  "security-audit-exceptions.json",
];

const FULL_SHA_ACTION_PATTERN =
  /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*@[0-9a-fA-F]{40}$/;
const GITLEAKS_LATEST_PATTERN = /gitleaks\/gitleaks:(latest|main|master)\b/i;
const FAIL_OPEN_AUDIT_PATTERN =
  /(?:pnpm\s+audit|security:check|security-audit\.mjs)[\s\S]{0,80}\|\|\s*true/;

export const TRUSTED_SELF_HOSTED_WORKFLOW = ".github/workflows/trusted-self-hosted.yml";
export const TRUSTED_WORKFLOW_PIN = "trusted-self-hosted.yml@refs/heads/main";
export const DEFAULT_RUNNER_GROUP = "Blitzcraft OSS Trusted";
export const WORKFLOWS_REQUIRING_HOSTED_FALLBACK = [
  ".github/workflows/ci.yml",
  ".github/workflows/ui-quality.yml",
  ".github/workflows/perf-bundle.yml",
];

export function listGithubYamlFiles(root = DEFAULT_REPO_ROOT) {
  const files = [];

  function walk(directory) {
    if (!existsSync(directory)) {
      return;
    }
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && /\.ya?ml$/i.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  walk(path.join(root, ".github", "workflows"));
  walk(path.join(root, ".github", "actions"));
  return files.sort();
}

function stripComments(content) {
  return content
    .split("\n")
    .map((line) => line.replace(/#.*$/, ""))
    .join("\n");
}

export function findInvalidActionRefs(content) {
  const matches = [];
  for (const line of content.split("\n")) {
    if (!line.includes("uses:")) {
      continue;
    }
    const stripped = line.replace(/#.*$/, "");
    const match = stripped.match(/uses:\s*(\S+)/);
    if (!match) {
      continue;
    }
    const uses = match[1];
    if (uses.startsWith("./") || uses.includes("/.github/workflows/")) {
      continue;
    }
    if (!FULL_SHA_ACTION_PATTERN.test(uses)) {
      matches.push(line.trim());
    }
  }
  return matches;
}

/** @deprecated Use findInvalidActionRefs — remote uses: must be exact 40-char SHAs. */
export function findMutableActionRefs(content) {
  return findInvalidActionRefs(content);
}

export function findMissingJobTimeouts(content) {
  const missing = [];
  const jobHeader = /^ {2}([A-Za-z0-9_-]+):\s*$/;
  const lines = content.split("\n");
  let inJobs = false;
  let currentJob = null;
  let jobHasTimeout = false;
  let jobUsesReusableWorkflow = false;
  let jobIndentSeen = false;

  for (const line of lines) {
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      continue;
    }
    if (inJobs && /^[a-zA-Z]/.test(line) && !line.startsWith(" ")) {
      if (currentJob && !jobHasTimeout && !jobUsesReusableWorkflow) {
        missing.push(currentJob);
      }
      break;
    }
    if (!inJobs) {
      continue;
    }
    const header = line.match(jobHeader);
    if (header) {
      if (currentJob && !jobHasTimeout && !jobUsesReusableWorkflow) {
        missing.push(currentJob);
      }
      currentJob = header[1];
      jobHasTimeout = false;
      jobUsesReusableWorkflow = false;
      jobIndentSeen = true;
      continue;
    }
    if (currentJob && /^\s{4}uses:\s+.*\/\.github\/workflows\//.test(line)) {
      jobUsesReusableWorkflow = true;
    }
    if (currentJob && /^\s{4}timeout-minutes:\s*\d+/.test(line)) {
      jobHasTimeout = true;
    }
  }

  if (inJobs && currentJob && !jobHasTimeout && !jobUsesReusableWorkflow && jobIndentSeen) {
    missing.push(currentJob);
  }

  return missing;
}

export function findMissingWorkflowPermissions(content) {
  if (/^permissions:/m.test(content) || /\npermissions:/m.test(content)) {
    return [];
  }
  return ["workflow-level-or-job permissions block"];
}

export function findPullRequestTargetRisks(content, relativePath) {
  const errors = [];
  if (
    !relativePath.startsWith(`.github/workflows${path.sep}`) &&
    !relativePath.startsWith(".github/workflows/")
  ) {
    return errors;
  }
  if (/pull_request_target/.test(content)) {
    errors.push(`${relativePath}: pull_request_target is not allowed`);
  }
  return errors;
}

function normalizeWorkflowPath(relativePath) {
  return relativePath.split(path.sep).join("/");
}

export function targetsTrustedRunnerGroup(content) {
  return /runs-on:\s*\n\s+group:/.test(content);
}

export function targetsLegacySelfHostedLabels(content) {
  return /runs-on:[\s\S]{0,400}\[.*self-hosted/.test(content);
}

/** @deprecated Prefer targetsTrustedRunnerGroup or targetsLegacySelfHostedLabels */
export function targetsTrustedRunnerInfrastructure(content) {
  return targetsTrustedRunnerGroup(content) || targetsLegacySelfHostedLabels(content);
}

export function callersUseTrustedWorkflow(root = DEFAULT_REPO_ROOT) {
  const workflowDir = path.join(root, ".github", "workflows");
  if (!existsSync(workflowDir)) {
    return false;
  }

  for (const entry of readdirSync(workflowDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.ya?ml$/i.test(entry.name)) {
      continue;
    }
    const content = stripComments(
      readFileSync(path.join(workflowDir, entry.name), "utf8")
    );
    if (content.includes("trusted-self-hosted.yml")) {
      return true;
    }
  }

  return false;
}

export function findDynamicLocalActionUses(content, relativePath) {
  const errors = [];
  for (const line of content.split("\n")) {
    if (/uses:\s*\.\/\$\{\{/.test(line)) {
      errors.push(`${relativePath}: local action uses paths must be static: ${line.trim()}`);
    }
  }
  return errors;
}

export function findReusableWorkflowCallerViolations(content, relativePath) {
  const errors = [];
  const lines = content.split("\n");
  let currentJob = null;
  let inReusableCaller = false;

  for (const line of lines) {
    const header = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (header) {
      currentJob = header[1];
      inReusableCaller = false;
      continue;
    }
    if (
      currentJob &&
      /^\s{4}uses:\s+.*\/\.github\/workflows\/trusted-self-hosted\.yml/.test(line)
    ) {
      inReusableCaller = true;
    }
    if (inReusableCaller && /^\s{4}timeout-minutes:/.test(line)) {
      errors.push(
        `${relativePath}: job "${currentJob}" must not set timeout-minutes on a reusable workflow caller`,
      );
    }
    if (inReusableCaller && /^\s{6}runner_group:/.test(line)) {
      errors.push(
        `${relativePath}: job "${currentJob}" must not pass runner_group to the trusted reusable workflow`,
      );
    }
    if (inReusableCaller && /^\s{4}secrets:\s*inherit\b/.test(line)) {
      errors.push(
        `${relativePath}: job "${currentJob}" must not use secrets: inherit for trusted self-hosted callers`,
      );
    }
  }

  return errors;
}

export function validateTrustedWorkflowDefinition(trustedContent, trustedRelative) {
  const errors = [];

  if (!/workflow_call:/.test(trustedContent)) {
    errors.push(
      `${trustedRelative}: trusted self-hosted workflow must be callable via workflow_call`,
    );
  }
  if (!/pull_request\.head\.repo\.full_name/.test(trustedContent)) {
    errors.push(
      `${trustedRelative}: trusted self-hosted workflow must gate execution on github.event.pull_request.head.repo.full_name`,
    );
  }
  if (/runner_group:/.test(trustedContent)) {
    errors.push(
      `${trustedRelative}: trusted self-hosted workflow must not accept runner_group from callers`,
    );
  }
  if (!/runs-on:[\s\S]*\bgroup:/.test(trustedContent)) {
    errors.push(
      `${trustedRelative}: trusted self-hosted workflow must select the runner group directly in runs-on`,
    );
  }
  if (!/labels:\s*ci\b/.test(trustedContent)) {
    errors.push(
      `${trustedRelative}: trusted self-hosted workflow must require the ci runner label`,
    );
  }
  if (
    !trustedContent.includes(DEFAULT_RUNNER_GROUP) &&
    !/vars\.ATLAS_CI_RUNNER_GROUP/.test(trustedContent)
  ) {
    errors.push(
      `${trustedRelative}: trusted self-hosted workflow must default to ${DEFAULT_RUNNER_GROUP}`,
    );
  }
  if (!/ci\|ui-quality\|bundle/.test(trustedContent)) {
    errors.push(`${trustedRelative}: trusted self-hosted workflow must validate allowed suite values`);
  }
  errors.push(...findDynamicLocalActionUses(trustedContent, trustedRelative));

  return errors;
}

export function validateCiRunnerPolicyPhase1(root = DEFAULT_REPO_ROOT) {
  const errors = [];
  const workflowDir = path.join(root, ".github", "workflows");
  if (!existsSync(workflowDir)) {
    errors.push("Missing .github/workflows directory");
    return errors;
  }

  const trustedPath = path.join(root, TRUSTED_SELF_HOSTED_WORKFLOW);
  if (!existsSync(trustedPath)) {
    errors.push(`Missing required trusted reusable workflow: ${TRUSTED_SELF_HOSTED_WORKFLOW}`);
    return errors;
  }

  const trustedContent = stripComments(readFileSync(trustedPath, "utf8"));
  errors.push(...validateTrustedWorkflowDefinition(trustedContent, TRUSTED_SELF_HOSTED_WORKFLOW));

  for (const entry of readdirSync(workflowDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.ya?ml$/i.test(entry.name)) {
      continue;
    }

    const filePath = path.join(workflowDir, entry.name);
    const relativePath = normalizeWorkflowPath(path.relative(root, filePath));
    const content = stripComments(readFileSync(filePath, "utf8"));

    errors.push(...findPullRequestTargetRisks(content, relativePath));
    errors.push(...findDynamicLocalActionUses(content, relativePath));

    if (relativePath === TRUSTED_SELF_HOSTED_WORKFLOW) {
      continue;
    }

    if (targetsTrustedRunnerGroup(content)) {
      errors.push(
        `${relativePath}: only ${TRUSTED_SELF_HOSTED_WORKFLOW} may target trusted self-hosted runner groups`,
      );
    }

    if (content.includes("trusted-self-hosted.yml")) {
      errors.push(
        `${relativePath}: Phase-2 trusted caller migration must not ship until ${TRUSTED_SELF_HOSTED_WORKFLOW} exists on main`,
      );
    }
  }

  return errors;
}

export function validateCiRunnerPolicyPhase2(root = DEFAULT_REPO_ROOT) {
  const errors = validateCiRunnerPolicyPhase1(root).filter(
    (error) => !error.includes("Phase-2 trusted caller migration must not ship"),
  );

  for (const relativePath of WORKFLOWS_REQUIRING_HOSTED_FALLBACK) {
    const filePath = path.join(root, relativePath);
    if (!existsSync(filePath)) {
      errors.push(`Missing workflow with required GitHub-hosted fallback: ${relativePath}`);
      continue;
    }

    const content = stripComments(readFileSync(filePath, "utf8"));

    if (!content.includes("trusted-self-hosted.yml")) {
      errors.push(`${relativePath}: must call the main-pinned trusted self-hosted reusable workflow`);
      continue;
    }
    if (!content.includes(TRUSTED_WORKFLOW_PIN)) {
      errors.push(
        `${relativePath}: trusted self-hosted reusable workflow must be pinned to ${TRUSTED_WORKFLOW_PIN}`,
      );
    }
    if (!/ATLAS_CI_RUNNER_PROFILE/.test(content)) {
      errors.push(`${relativePath}: trusted self-hosted callers must read ATLAS_CI_RUNNER_PROFILE`);
    }
    if (!/ATLAS_CI_USE_SELF_HOSTED/.test(content)) {
      errors.push(`${relativePath}: trusted self-hosted callers must define ATLAS_CI_USE_SELF_HOSTED`);
    }
    if (!/name: (CI|UI Quality|Bundle Analysis)\n/.test(content) && !/name: CI\n/.test(content)) {
      // aggregator names checked per workflow below
    }
    if (targetsTrustedRunnerGroup(content) || targetsLegacySelfHostedLabels(content)) {
      errors.push(
        `${relativePath}: Phase-2 callers must not target trusted runner infrastructure directly`,
      );
    }

    errors.push(...findReusableWorkflowCallerViolations(content, relativePath));

    const expected =
      relativePath.endsWith("ci.yml")
        ? { hosted: "CI (hosted)", aggregate: "CI" }
        : relativePath.endsWith("ui-quality.yml")
          ? { hosted: "UI Quality (hosted)", aggregate: "UI Quality" }
          : { hosted: "Bundle Analysis (hosted)", aggregate: "Bundle Analysis" };

    if (!content.includes(`name: ${expected.hosted}`)) {
      errors.push(
        `${relativePath}: must define a GitHub-hosted executor named "${expected.hosted}"`,
      );
    }
    if (!new RegExp(`\\n {4}name: ${expected.aggregate}\\n`).test(content)) {
      errors.push(
        `${relativePath}: must define a final aggregator job named "${expected.aggregate}"`,
      );
    }
  }

  return errors;
}

export function validateCiRunnerPolicy(root = DEFAULT_REPO_ROOT) {
  if (callersUseTrustedWorkflow(root)) {
    return validateCiRunnerPolicyPhase2(root);
  }
  return validateCiRunnerPolicyPhase1(root);
}

export function findGitleaksPinIssues(content, policy) {
  const errors = [];
  if (GITLEAKS_LATEST_PATTERN.test(content)) {
    errors.push("Gitleaks image uses a mutable tag");
  }

  if (!content.includes("gitleaks/gitleaks")) {
    return errors;
  }

  const expected = `${policy.gitleaks.image}@${policy.gitleaks.digest}`;
  if (!content.includes(policy.gitleaks.digest)) {
    errors.push(`Gitleaks image must be pinned to ${expected} (${policy.gitleaks.version})`);
  }
  if (
    !content.includes("--network=none") ||
    !content.includes("--redact") ||
    !content.includes("--exit-code 1")
  ) {
    errors.push("Gitleaks invocation must keep --network=none, --redact, and --exit-code 1");
  }
  if (content.includes("--no-git")) {
    errors.push("Gitleaks must scan git history; --no-git is not allowed");
  }
  return errors;
}

export function findFailOpenSecurityPolicy(content, relativePath) {
  const errors = [];
  if (relativePath.endsWith("security-audit.yml") && /\|\|\s*true/.test(content)) {
    errors.push(`${relativePath}: || true is not allowed around the security audit`);
  }
  if (FAIL_OPEN_AUDIT_PATTERN.test(content)) {
    errors.push(`${relativePath}: security policy must not be fail-open with || true`);
  }
  if (relativePath.endsWith("security-audit.yml") && /continue-on-error:\s*true/.test(content)) {
    errors.push(`${relativePath}: continue-on-error is not allowed on the security audit`);
  }
  return errors;
}

export function validateGithubWorkflows(root = DEFAULT_REPO_ROOT) {
  const errors = [];
  const policy = loadPolicy(root);

  for (const relativePath of REQUIRED_DOCUMENTS) {
    if (!existsSync(path.join(root, relativePath))) {
      errors.push(`Missing required security document: ${relativePath}`);
    }
  }

  const files = listGithubYamlFiles(root);
  if (files.length === 0) {
    errors.push("No GitHub workflow or action YAML files found");
  }

  for (const filePath of files) {
    const relativePath = path.relative(root, filePath);
    const content = readFileSync(filePath, "utf8");
    const uncommented = stripComments(content);

    for (const match of findInvalidActionRefs(content)) {
      errors.push(
        `${relativePath}: remote GitHub Action reference must be a 40-character commit SHA: ${match}`
      );
    }

    if (relativePath.startsWith(`.github/workflows${path.sep}`)) {
      for (const job of findMissingJobTimeouts(content)) {
        errors.push(`${relativePath}: job "${job}" is missing timeout-minutes`);
      }
      for (const missing of findMissingWorkflowPermissions(content)) {
        errors.push(`${relativePath}: missing ${missing}`);
      }
    }

    errors.push(...findPullRequestTargetRisks(uncommented, relativePath));
    errors.push(...findGitleaksPinIssues(content, policy));
    errors.push(...findFailOpenSecurityPolicy(content, relativePath));
  }

  errors.push(...validateCiRunnerPolicy(root));
  errors.push(...runActionlint(root));

  return errors;
}

function main() {
  const errors = validateGithubWorkflows();
  if (errors.length > 0) {
    process.stderr.write("GitHub workflow security check failed:\n");
    for (const error of errors) {
      process.stderr.write(`  ✗ ${error}\n`);
    }
    process.exit(1);
  }

  process.stdout.write("✓ GitHub workflow security checks passed\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main();
}
