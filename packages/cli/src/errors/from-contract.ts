import {
  AtlasContractError,
  AtlasContractErrorCode,
  type AtlasContractErrorCode as AtlasContractErrorCodeType,
} from "@atlas/project";

import { BootstrapAssetError } from "../bootstrap/errors";

import { CliError, CliErrorCode } from "./cli-error";

const CONTRACT_TO_CLI_CODE: Record<AtlasContractErrorCodeType, CliErrorCode> = {
  [AtlasContractErrorCode.CONTRACT_NOT_FOUND]: CliErrorCode.PROJECT_NOT_FOUND,
  [AtlasContractErrorCode.CONTRACT_INVALID_JSON]: CliErrorCode.CONTRACT_INVALID,
  [AtlasContractErrorCode.CONTRACT_VALIDATION_FAILED]: CliErrorCode.CONTRACT_INVALID,
  [AtlasContractErrorCode.CONTRACT_UNSUPPORTED_VERSION]: CliErrorCode.CONTRACT_INVALID,
  [AtlasContractErrorCode.CONTRACT_STRUCTURE_INVALID]: CliErrorCode.CONTRACT_INVALID,
};

export function cliErrorFromContract(error: unknown): CliError {
  if (error instanceof AtlasContractError) {
    const code = CONTRACT_TO_CLI_CODE[error.code] ?? CliErrorCode.CONTRACT_INVALID;
    return new CliError(code, error.message, {
      details: error.details,
      cause: error,
    });
  }

  return cliErrorFromUnknown(error);
}

export function cliErrorFromUnknown(error: unknown, debug = false): CliError {
  if (error instanceof CliError) {
    return error;
  }

  if (error instanceof AtlasContractError) {
    return cliErrorFromContract(error);
  }

  if (error instanceof BootstrapAssetError) {
    return new CliError(CliErrorCode.PREREQUISITE_ERROR, error.message, { cause: error });
  }

  if (error instanceof Error) {
    const message = debug ? `${error.message}\n${error.stack ?? ""}` : error.message;
    return new CliError(CliErrorCode.INTERNAL_ERROR, message, { cause: error });
  }

  return new CliError(CliErrorCode.INTERNAL_ERROR, "An unexpected error occurred.", {
    cause: error,
  });
}
