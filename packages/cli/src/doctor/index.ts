import { createDoctorContext } from "./context";
import { formatDoctorReport } from "./format";
import { doctorReportHasErrors, runDoctorChecks } from "./runner";

import type { DoctorReport } from "./types";

export interface RunDoctorOptions {
  cwd?: string;
}

export async function runDoctor(options: RunDoctorOptions = {}): Promise<DoctorReport> {
  const context = createDoctorContext({ cwd: options.cwd });
  return runDoctorChecks(context);
}

export function formatDoctorHumanReport(report: DoctorReport): string[] {
  return formatDoctorReport(report);
}

export function doctorExitCodeIndicatesFailure(report: DoctorReport): boolean {
  return doctorReportHasErrors(report);
}
