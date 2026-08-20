export const AtlasContractErrorCode = {
  CONTRACT_NOT_FOUND: "CONTRACT_NOT_FOUND",
  CONTRACT_INVALID_JSON: "CONTRACT_INVALID_JSON",
  CONTRACT_VALIDATION_FAILED: "CONTRACT_VALIDATION_FAILED",
  CONTRACT_UNSUPPORTED_VERSION: "CONTRACT_UNSUPPORTED_VERSION",
  CONTRACT_STRUCTURE_INVALID: "CONTRACT_STRUCTURE_INVALID",
} as const;

export type AtlasContractErrorCode =
  (typeof AtlasContractErrorCode)[keyof typeof AtlasContractErrorCode];

export class AtlasContractError extends Error {
  readonly code: AtlasContractErrorCode;
  readonly details?: string[];

  constructor(code: AtlasContractErrorCode, message: string, details?: string[]) {
    super(message);
    this.name = "AtlasContractError";
    this.code = code;
    this.details = details;
  }
}

export function formatUnsupportedSchemaVersion(version: number): string {
  return (
    `Unsupported Atlas contract schema version ${version}. ` +
    `This installation supports contract schema version 1.`
  );
}

export function formatValidationErrors(errors: string[]): string {
  const header = "Atlas contract validation failed:";
  if (errors.length === 0) {
    return header;
  }

  return [header, ...errors.map((error) => `  - ${error}`)].join("\n");
}
