import path from "node:path";

import { createDiagnostic, DOCTOR_DIAGNOSTIC_DEFINITIONS } from "./diagnostics";

import type { DoctorDiagnostic } from "./types";

const DOCTOR_TAG_PREFIX = "@atlas-doctor:";

const ARCHITECTURE_RULE_IDS = new Set([
  "no-restricted-imports",
  "no-restricted-syntax",
  "no-restricted-globals",
]);

export interface EslintLintMessage {
  ruleId: string | null;
  message: string;
  line?: number;
  column?: number;
  filePath?: string;
}

export function isArchitectureEslintMessage(message: EslintLintMessage): boolean {
  if (!message.ruleId || !ARCHITECTURE_RULE_IDS.has(message.ruleId)) {
    return false;
  }

  return parseDoctorTagFromMessage(message.message) !== undefined;
}

export function mapEslintMessageToDiagnostic(
  repoRoot: string,
  _applicationRoot: string,
  message: EslintLintMessage
): DoctorDiagnostic | undefined {
  if (!isArchitectureEslintMessage(message)) {
    return undefined;
  }

  const code = parseDoctorTagFromMessage(message.message);
  if (!code || !(code in DOCTOR_DIAGNOSTIC_DEFINITIONS)) {
    return undefined;
  }

  const humanMessage = message.message
    .split("\n")
    .filter((line) => !line.startsWith(DOCTOR_TAG_PREFIX))
    .join("\n")
    .trim();

  return createDiagnostic(code, humanMessage, {
    path: message.filePath ? toRepoRelativePath(repoRoot, message.filePath) : undefined,
    line: message.line,
    column: message.column,
  });
}

function parseDoctorTagFromMessage(message: string): string | undefined {
  const lines = message.split("\n");
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line?.startsWith(DOCTOR_TAG_PREFIX)) {
      return line.slice(DOCTOR_TAG_PREFIX.length);
    }
  }

  return undefined;
}

function toRepoRelativePath(repoRoot: string, filePath: string): string {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

export function sortDiagnostics(diagnostics: DoctorDiagnostic[]): DoctorDiagnostic[] {
  return [...diagnostics].sort((left, right) => {
    const severityRank = (severity: DoctorDiagnostic["severity"]) => (severity === "error" ? 0 : 1);
    const severityCompare = severityRank(left.severity) - severityRank(right.severity);
    if (severityCompare !== 0) {
      return severityCompare;
    }

    const pathCompare = (left.path ?? "").localeCompare(right.path ?? "");
    if (pathCompare !== 0) {
      return pathCompare;
    }

    const lineCompare = (left.line ?? 0) - (right.line ?? 0);
    if (lineCompare !== 0) {
      return lineCompare;
    }

    return left.code.localeCompare(right.code);
  });
}
