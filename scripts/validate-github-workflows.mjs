#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_REPO_ROOT, loadPolicy } from "./security-audit-policy.mjs";

const scriptPath = fileURLToPath(import.meta.url);

const REQUIRED_DOCUMENTS = [
  "SECURITY.md",
  "docs/security/threat-model.md",
  "docs/how-we-build/security.md",
  "security/policy.json",
  "security-audit-exceptions.json",
];

const MUTABLE_REF_PATTERN =
  /uses:\s*(?!\.\/)([^\s#]+?)@(main|master|latest|v?\d+(?:\.\d+){0,2})\b/i;
const SHA_REF_PATTERN = /uses:\s*(?!\.\/)([^\s#]+?)@([0-9a-f]{40})\b/i;
const GITLEAKS_LATEST_PATTERN = /gitleaks\/gitleaks:(latest|main|master)\b/i;
const FAIL_OPEN_AUDIT_PATTERN =
  /(?:pnpm\s+audit|security:check|security-audit\.mjs)[\s\S]{0,80}\|\|\s*true/;

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

export function findMutableActionRefs(content) {
  const matches = [];
  for (const line of content.split("\n")) {
    if (!line.includes("uses:")) {
      continue;
    }
    const stripped = line.replace(/#.*$/, "");
    if (MUTABLE_REF_PATTERN.test(stripped) && !SHA_REF_PATTERN.test(stripped)) {
      matches.push(line.trim());
    }
  }
  return matches;
}

export function findMissingJobTimeouts(content) {
  const missing = [];
  const jobHeader = /^ {2}([A-Za-z0-9_-]+):\s*$/;
  const lines = content.split("\n");
  let inJobs = false;
  let currentJob = null;
  let jobHasTimeout = false;
  let jobIndentSeen = false;

  for (const line of lines) {
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      continue;
    }
    if (inJobs && /^[a-zA-Z]/.test(line) && !line.startsWith(" ")) {
      if (currentJob && !jobHasTimeout) {
        missing.push(currentJob);
      }
      break;
    }
    if (!inJobs) {
      continue;
    }
    const header = line.match(jobHeader);
    if (header) {
      if (currentJob && !jobHasTimeout) {
        missing.push(currentJob);
      }
      currentJob = header[1];
      jobHasTimeout = false;
      jobIndentSeen = true;
      continue;
    }
    if (currentJob && /^\s{4}timeout-minutes:\s*\d+/.test(line)) {
      jobHasTimeout = true;
    }
  }

  if (inJobs && currentJob && !jobHasTimeout && jobIndentSeen) {
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

export function findSelfHostedForkRisks(content, relativePath) {
  const errors = [];
  if (!relativePath.startsWith(`.github/workflows${path.sep}`) && !relativePath.startsWith(".github/workflows/")) {
    return errors;
  }
  if (/pull_request_target/.test(content)) {
    errors.push(`${relativePath}: pull_request_target is not allowed`);
  }

  const usesSelfHosted = /\[\s*self-hosted/.test(content) || /runs-on:[\s\S]{0,200}self-hosted/.test(content);
  if (!usesSelfHosted) {
    return errors;
  }

  if (!/pull_request\.head\.repo\.full_name/.test(content)) {
    errors.push(
      `${relativePath}: self-hosted runners must be gated on github.event.pull_request.head.repo.full_name == github.repository`,
    );
  }

  return errors;
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
  if (!content.includes("--network=none") || !content.includes("--redact") || !content.includes("--exit-code 1")) {
    errors.push("Gitleaks invocation must keep --network=none, --redact, and --exit-code 1");
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
  if (
    relativePath.endsWith("security-audit.yml") &&
    /continue-on-error:\s*true/.test(content)
  ) {
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

    for (const match of findMutableActionRefs(content)) {
      errors.push(`${relativePath}: mutable GitHub Action reference: ${match}`);
    }

    if (relativePath.startsWith(`.github/workflows${path.sep}`)) {
      for (const job of findMissingJobTimeouts(content)) {
        errors.push(`${relativePath}: job "${job}" is missing timeout-minutes`);
      }
      for (const missing of findMissingWorkflowPermissions(content)) {
        errors.push(`${relativePath}: missing ${missing}`);
      }
    }

    errors.push(...findSelfHostedForkRisks(uncommented, relativePath));
    errors.push(...findGitleaksPinIssues(content, policy));
    errors.push(...findFailOpenSecurityPolicy(content, relativePath));
  }

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
