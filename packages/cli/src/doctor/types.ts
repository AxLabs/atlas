import type { DoctorContext } from "./context";

export const DOCTOR_REPORT_SCHEMA_VERSION = 1;

export type DoctorCheckStatus = "pass" | "warn" | "fail" | "skip";
export type DoctorReportStatus = "healthy" | "warning" | "failed";
export type DoctorDiagnosticSeverity = "warning" | "error";

export interface DoctorDiagnostic {
  code: string;
  severity: DoctorDiagnosticSeverity;
  message: string;
  suggestedFix: string;
  documentation?: string;
  path?: string;
  line?: number;
  column?: number;
}

export interface DoctorCheckResult {
  id: string;
  title: string;
  status: DoctorCheckStatus;
  rationale: string;
  diagnostics: DoctorDiagnostic[];
  skipReason?: string;
}

export interface DoctorReportSummary {
  passed: number;
  warnings: number;
  errors: number;
  skipped: number;
}

export interface DoctorReport {
  schemaVersion: number;
  status: DoctorReportStatus;
  atlasVersion: string;
  projectRoot: string;
  summary: DoctorReportSummary;
  checks: DoctorCheckResult[];
  diagnostics: DoctorDiagnostic[];
}

export interface DoctorCheckDefinition {
  id: string;
  title: string;
  rationale: string;
  run: (context: DoctorContext) => Promise<DoctorCheckResult> | DoctorCheckResult;
}
