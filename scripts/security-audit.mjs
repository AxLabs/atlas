#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_REPO_ROOT,
  assertAuditDocument,
  evaluateSecurityAudit,
  formatSecuritySummary,
  isOperationalError,
  loadExceptions,
  loadJsonFile,
  loadPolicy,
  operationalError,
  todayUtc,
} from "./security-audit-policy.mjs";

const scriptPath = fileURLToPath(import.meta.url);

function parseArgs(argv) {
  const options = {
    auditJson: null,
    exceptions: null,
    policyRoot: DEFAULT_REPO_ROOT,
    now: todayUtc(),
    outputJson: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--audit-json") {
      options.auditJson = argv[index + 1];
      index += 1;
    } else if (arg === "--exceptions") {
      options.exceptions = argv[index + 1];
      index += 1;
    } else if (arg === "--root") {
      options.policyRoot = argv[index + 1];
      index += 1;
    } else if (arg === "--now") {
      options.now = argv[index + 1];
      index += 1;
    } else if (arg === "--output-json") {
      options.outputJson = argv[index + 1];
      index += 1;
    } else if (arg === "--help") {
      options.help = true;
    }
  }

  return options;
}

function runPnpmAudit(root) {
  const result = spawnSync("pnpm", ["audit", "--json"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: process.env,
  });

  if (result.error) {
    throw operationalError(`pnpm audit failed to start: ${result.error.message}`);
  }

  const stdout = result.stdout ?? "";
  if (!stdout.trim()) {
    throw operationalError(
      `pnpm audit returned no JSON (exit ${result.status}): ${(result.stderr ?? "").trim()}`,
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    throw operationalError(`pnpm audit returned malformed JSON: ${error.message}`);
  }

  assertAuditDocument(parsed);

  if (result.status !== 0 && result.status !== 1) {
    throw operationalError(
      `pnpm audit failed with unexpected exit ${result.status}: ${(result.stderr ?? "").trim()}`,
    );
  }

  return { audit: parsed, raw: stdout, status: result.status };
}

export function runSecurityAudit(options = {}) {
  const root = options.policyRoot ?? DEFAULT_REPO_ROOT;
  const policy = loadPolicy(root);
  const exceptions = options.exceptions
    ? loadJsonFile(options.exceptions, "exceptions").exceptions
    : loadExceptions(root);

  if (!Array.isArray(exceptions)) {
    throw operationalError("exceptions must be an array");
  }

  let audit;
  let raw = null;
  if (options.auditJson) {
    audit = loadJsonFile(options.auditJson, "audit fixture");
    assertAuditDocument(audit);
    raw = JSON.stringify(audit, null, 2);
  } else {
    const retrieved = runPnpmAudit(root);
    audit = retrieved.audit;
    raw = retrieved.raw;
  }

  const evaluation = evaluateSecurityAudit({
    audit,
    exceptions,
    policy,
    now: options.now ?? todayUtc(),
  });

  return { policy, evaluation, raw };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(
      "Usage: node scripts/security-audit.mjs [--audit-json <file>] [--exceptions <file>] [--now YYYY-MM-DD]\n",
    );
    process.exit(0);
  }

  try {
    const result = runSecurityAudit(options);
    const summary = formatSecuritySummary(result.evaluation, result.policy);
    process.stdout.write(`${summary}\n`);

    if (options.outputJson) {
      const directory = path.dirname(options.outputJson);
      if (directory && directory !== ".") {
        mkdirSync(directory, { recursive: true });
      }
      writeFileSync(
        options.outputJson,
        `${JSON.stringify(
          {
            policy: {
              minimumBlockingSeverity: result.policy.minimumBlockingSeverity,
            },
            counts: result.evaluation.counts,
            blocking: result.evaluation.blocking,
            excepted: result.evaluation.excepted.map((entry) => entry.finding.advisoryId),
            expired: result.evaluation.expired.map((entry) => entry.finding.advisoryId),
            stale: result.evaluation.stale.map((entry) => exceptionKey(entry)),
            ok: result.evaluation.ok,
          },
          null,
          2,
        )}\n`,
      );
    }

    const artifactDir = process.env.ATLAS_SECURITY_AUDIT_DIR;
    if (artifactDir && result.raw) {
      mkdirSync(artifactDir, { recursive: true });
      writeFileSync(path.join(artifactDir, "pnpm-audit.json"), result.raw);
    }

    process.exit(result.evaluation.ok ? 0 : 1);
  } catch (error) {
    if (isOperationalError(error)) {
      process.stderr.write(`✗ Dependency vulnerability policy failed closed\n  ${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
}

function exceptionKey(exception) {
  return `${exception.advisoryId}::${exception.packageName}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main();
}
