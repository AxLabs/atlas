#!/usr/bin/env node
/**
 * Evaluate Istanbul coverage-final.json reports against named subsystem floors.
 *
 * Fail closed: missing report, missing subsystem, zero matched files, or a metric
 * below threshold exits non-zero.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..");

const METRICS = ["statements", "branches", "functions", "lines"];

export function globToRegExp(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\0double\0")
    .replace(/\*/g, "[^/]*")
    .replace(/\0double\0/g, ".*");
  return new RegExp(`^${escaped}$`);
}

export function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

export function matchesAny(filePath, patterns) {
  if (!patterns || patterns.length === 0) {
    return false;
  }
  const posix = toPosixPath(filePath);
  return patterns.some((pattern) => globToRegExp(pattern).test(posix));
}

function countHits(values) {
  let covered = 0;
  let total = 0;
  for (const value of values) {
    if (Array.isArray(value)) {
      for (const hit of value) {
        total += 1;
        if (hit > 0) covered += 1;
      }
    } else {
      total += 1;
      if (value > 0) covered += 1;
    }
  }
  return { covered, total };
}

export function summarizeFileCoverage(fileCoverage) {
  const statements = countHits(Object.values(fileCoverage.s ?? {}));
  const functions = countHits(Object.values(fileCoverage.f ?? {}));
  const branches = countHits(Object.values(fileCoverage.b ?? {}));
  const lines = fileCoverage.l
    ? countHits(Object.values(fileCoverage.l))
    : statements;
  return { statements, functions, branches, lines };
}

export function mergeSummaries(summaries) {
  const merged = {
    statements: { covered: 0, total: 0 },
    functions: { covered: 0, total: 0 },
    branches: { covered: 0, total: 0 },
    lines: { covered: 0, total: 0 },
  };
  for (const summary of summaries) {
    for (const metric of METRICS) {
      merged[metric].covered += summary[metric].covered;
      merged[metric].total += summary[metric].total;
    }
  }
  return merged;
}

export function percent(covered, total) {
  if (total === 0) return 100;
  return (covered / total) * 100;
}

export function loadPolicy(policyPath) {
  const raw = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.reports) || !Array.isArray(raw.subsystems)) {
    throw new Error("Coverage policy must include reports[] and subsystems[]");
  }
  return raw;
}

export function loadCoverageReport(reportPath) {
  if (!fs.existsSync(reportPath)) {
    throw new Error(`Missing coverage report: ${reportPath}`);
  }
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    throw new Error(`Coverage report is not an Istanbul coverage-final object: ${reportPath}`);
  }
  return report;
}

export function evaluateSubsystem(subsystem, report) {
  const matched = [];
  for (const [filePath, fileCoverage] of Object.entries(report)) {
    if (subsystem.exclude && matchesAny(filePath, subsystem.exclude)) {
      continue;
    }
    if (!subsystem.include || !matchesAny(filePath, subsystem.include)) {
      continue;
    }
    matched.push({ filePath, summary: summarizeFileCoverage(fileCoverage) });
  }

  if (matched.length === 0) {
    return {
      id: subsystem.id,
      ok: false,
      reason: "zero-matched-files",
      matchedFiles: 0,
      percents: {},
      failures: [`Subsystem ${subsystem.id} matched zero coverage files`],
    };
  }

  const merged = mergeSummaries(matched.map((entry) => entry.summary));
  const thresholds = subsystem.thresholds ?? {};
  const percents = {};
  const failures = [];

  for (const metric of METRICS) {
    if (typeof thresholds[metric] !== "number") continue;
    const value = percent(merged[metric].covered, merged[metric].total);
    percents[metric] = value;
    if (merged[metric].total === 0) {
      failures.push(`${subsystem.id} ${metric}: no instrumented ${metric}`);
    } else if (value + 1e-9 < thresholds[metric]) {
      failures.push(
        `${subsystem.id} ${metric}: ${value.toFixed(2)}% < ${thresholds[metric]}%`
      );
    }
  }

  return {
    id: subsystem.id,
    ok: failures.length === 0,
    matchedFiles: matched.length,
    percents,
    totals: merged,
    failures,
  };
}

export function evaluateCoveragePolicy({ policy, reports }) {
  const results = [];
  const failures = [];

  const reportById = new Map(policy.reports.map((entry) => [entry.id, entry]));

  for (const subsystem of policy.subsystems) {
    const reportEntry = reportById.get(subsystem.report);
    if (!reportEntry) {
      const message = `Subsystem ${subsystem.id} references unknown report "${subsystem.report}"`;
      failures.push(message);
      results.push({ id: subsystem.id, ok: false, reason: "missing-report-id", failures: [message] });
      continue;
    }

    const reportPath = reports[subsystem.report];
    if (!reportPath) {
      const message = `Missing coverage report mapping for "${subsystem.report}"`;
      failures.push(message);
      results.push({ id: subsystem.id, ok: false, reason: "missing-report", failures: [message] });
      continue;
    }

    let report;
    try {
      report = loadCoverageReport(reportPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(message);
      results.push({ id: subsystem.id, ok: false, reason: "missing-report", failures: [message] });
      continue;
    }

    const result = evaluateSubsystem(subsystem, report);
    results.push(result);
    failures.push(...result.failures);
  }

  const expectedIds = policy.subsystems.map((subsystem) => subsystem.id);
  for (const id of expectedIds) {
    if (!results.some((result) => result.id === id)) {
      failures.push(`Missing expected subsystem: ${id}`);
    }
  }

  return {
    ok: failures.length === 0,
    results,
    failures,
  };
}

export function formatCoverageSummary(evaluation) {
  const lines = ["Atlas risk coverage policy", ""];
  for (const result of evaluation.results) {
    const status = result.ok ? "pass" : "FAIL";
    const percents = METRICS.filter((metric) => typeof result.percents?.[metric] === "number")
      .map((metric) => `${metric}=${result.percents[metric].toFixed(1)}%`)
      .join(" ");
    lines.push(`- ${result.id}: ${status} files=${result.matchedFiles ?? 0} ${percents}`.trim());
  }
  if (evaluation.failures.length > 0) {
    lines.push("", "Failures:");
    for (const failure of evaluation.failures) {
      lines.push(`  - ${failure}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const args = { policy: path.join(REPO_ROOT, "coverage-policy.json"), reports: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === "--policy") {
      args.policy = path.resolve(argv[++i]);
    } else if (current === "--report") {
      const id = argv[++i];
      const reportPath = path.resolve(argv[++i]);
      args.reports[id] = reportPath;
    }
  }
  return args;
}

export function resolveReportPaths(policy, overrides, repoRoot = REPO_ROOT) {
  const reports = {};
  for (const entry of policy.reports) {
    reports[entry.id] = overrides[entry.id] ?? path.join(repoRoot, entry.path);
  }
  return reports;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const policy = loadPolicy(args.policy);
  const reports = resolveReportPaths(policy, args.reports);
  const evaluation = evaluateCoveragePolicy({ policy, reports });
  process.stdout.write(formatCoverageSummary(evaluation));
  process.exit(evaluation.ok ? 0 : 1);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main();
}
