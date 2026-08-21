import type { DoctorCheckResult, DoctorDiagnostic, DoctorReport } from "./types";

const STATUS_SYMBOL: Record<DoctorCheckResult["status"], string> = {
  pass: "✓",
  warn: "⚠",
  fail: "✗",
  skip: "–",
};

export function formatDoctorReport(report: DoctorReport): string[] {
  const lines = ["Atlas Doctor", ""];

  for (const check of report.checks) {
    lines.push(`${STATUS_SYMBOL[check.status]} ${check.title}`);
    if (check.status === "skip" && check.skipReason) {
      lines.push(`  ${check.skipReason}`);
      lines.push("");
      continue;
    }

    for (const diagnostic of check.diagnostics) {
      lines.push(...formatDiagnosticBlock(diagnostic));
    }

    lines.push("");
  }

  lines.push(formatSummary(report));

  const totalChecks =
    report.summary.checksPassed +
    report.summary.checksWarned +
    report.summary.checksFailed +
    report.summary.checksSkipped;

  if (report.status === "healthy" && report.summary.checksSkipped > 0) {
    lines.push("Doctor found no errors. Some checks were skipped.");
  } else if (report.status === "healthy") {
    lines.push(`${totalChecks} checks passed · 0 warnings · 0 errors`);
  }

  return lines.filter((line, index, array) => !(line === "" && index === array.length - 1));
}

function formatDiagnosticBlock(diagnostic: DoctorDiagnostic): string[] {
  const lines = [`  ${diagnostic.code}`];
  if (diagnostic.path) {
    lines.push(`  ${diagnostic.path}`);
  }

  lines.push(`  ${diagnostic.message.split("\n")[0]}`);
  lines.push("");
  lines.push("  Fix:");
  lines.push(`  ${diagnostic.suggestedFix}`);

  if (diagnostic.documentation) {
    lines.push("");
    lines.push("  Docs:");
    lines.push(`  ${diagnostic.documentation}`);
  }

  lines.push("");
  return lines;
}

function formatSummary(report: DoctorReport): string {
  const totalChecks =
    report.summary.checksPassed +
    report.summary.checksWarned +
    report.summary.checksFailed +
    report.summary.checksSkipped;

  return [
    "Summary:",
    `${totalChecks} checks: ${report.summary.checksPassed} passed · ${report.summary.checksFailed} failed · ${report.summary.checksSkipped} skipped`,
    `${report.summary.diagnosticWarnings + report.summary.diagnosticErrors} diagnostics: ${report.summary.diagnosticWarnings} warnings · ${report.summary.diagnosticErrors} errors`,
  ].join("\n");
}
