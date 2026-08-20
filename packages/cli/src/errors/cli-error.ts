import { ExitCode } from "../exit-codes";

export const CliErrorCode = {
  USAGE_ERROR: "USAGE_ERROR",
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
  CONTRACT_INVALID: "CONTRACT_INVALID",
  BOOTSTRAP_CONFLICT: "BOOTSTRAP_CONFLICT",
  PREREQUISITE_ERROR: "PREREQUISITE_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type CliErrorCode = (typeof CliErrorCode)[keyof typeof CliErrorCode];

const EXIT_CODE_BY_CLI_ERROR: Record<CliErrorCode, ExitCode> = {
  [CliErrorCode.USAGE_ERROR]: ExitCode.USAGE_ERROR,
  [CliErrorCode.PROJECT_NOT_FOUND]: ExitCode.PROJECT_NOT_FOUND,
  [CliErrorCode.CONTRACT_INVALID]: ExitCode.CONTRACT_INVALID,
  [CliErrorCode.BOOTSTRAP_CONFLICT]: ExitCode.BOOTSTRAP_CONFLICT,
  [CliErrorCode.PREREQUISITE_ERROR]: ExitCode.PREREQUISITE_ERROR,
  [CliErrorCode.INTERNAL_ERROR]: ExitCode.INTERNAL_ERROR,
};

export class CliError extends Error {
  readonly code: CliErrorCode;
  readonly exitCode: ExitCode;
  readonly details?: string[];
  readonly cause?: unknown;

  constructor(
    code: CliErrorCode,
    message: string,
    options?: { details?: string[]; cause?: unknown }
  ) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.exitCode = EXIT_CODE_BY_CLI_ERROR[code];
    this.details = options?.details;
    this.cause = options?.cause;
  }
}

export function isCliError(error: unknown): error is CliError {
  return error instanceof CliError;
}
