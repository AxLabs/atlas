import { doctorExitCodeIndicatesFailure, formatDoctorHumanReport, runDoctor } from "../doctor";
import { ExitCode } from "../exit-codes";
import { writeCommandSuccess } from "../output/write";

import type { OutputWriter } from "../output/write";

export function writeDoctorHelp(writer: OutputWriter, json: boolean): void {
  const lines = [
    "Atlas Doctor — diagnose Atlas architecture and configuration drift",
    "",
    "Doctor validates Atlas-specific contracts, ownership boundaries, workspace structure,",
    "and deterministic generated-artifact health. It does not replace pnpm lint, typecheck,",
    "tests, build, or security tooling.",
    "",
    "Usage:",
    "  atlas doctor [options]",
    "",
    "Exit behavior:",
    "  0 — healthy or warnings only",
    "  8 — one or more architectural error diagnostics",
    "",
    "Options:",
    "  --json           Emit machine-readable JSON on stdout",
    "  --cwd <path>     Resolve the Atlas repository from a starting directory",
    "",
    "See docs/how-we-build/doctor.md for diagnostic codes and ownership boundaries.",
  ];

  if (json) {
    writer.writeStdout(
      JSON.stringify({
        ok: true,
        command: "doctor-help",
        result: { lines },
      })
    );
    return;
  }

  for (const line of lines) {
    writer.writeStdout(line);
  }
}

export async function runDoctorCommand(options: {
  cwd?: string;
  json: boolean;
  writer: OutputWriter;
}): Promise<number> {
  const report = await runDoctor({ cwd: options.cwd });

  writeCommandSuccess(options.writer, "doctor", report, options.json, formatDoctorHumanReport);

  return doctorExitCodeIndicatesFailure(report) ? ExitCode.DOCTOR_FAILED : ExitCode.SUCCESS;
}
