import type { DoctorDiagnostic } from "./types";

export class DoctorCheckExecutionError extends Error {
  readonly partialDiagnostics: DoctorDiagnostic[];

  constructor(message: string, partialDiagnostics: DoctorDiagnostic[] = []) {
    super(message);
    this.name = "DoctorCheckExecutionError";
    this.partialDiagnostics = partialDiagnostics;
  }
}
