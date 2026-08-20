/** Documented CLI exit codes for automation and CI scripts. */
export const ExitCode = {
  SUCCESS: 0,
  INTERNAL_ERROR: 1,
  USAGE_ERROR: 2,
  PROJECT_NOT_FOUND: 3,
  CONTRACT_INVALID: 4,
  BOOTSTRAP_CONFLICT: 5,
  PREREQUISITE_ERROR: 6,
  GENERATOR_CONFLICT: 7,
  DOCTOR_FAILED: 8,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

export type ExitCodeName = keyof typeof ExitCode;
