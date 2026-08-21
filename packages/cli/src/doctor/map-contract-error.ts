import {
  type AtlasContractError,
  AtlasContractErrorCode,
  type AtlasContractErrorCodeType,
} from "@atlas/project";

import { createDiagnostic, DoctorDiagnosticCode } from "./diagnostics";

import type { DoctorDiagnostic } from "./types";

const CONTRACT_CODE_MAP: Record<AtlasContractErrorCodeType, string> = {
  [AtlasContractErrorCode.CONTRACT_NOT_FOUND]: DoctorDiagnosticCode.CONTRACT_MISSING,
  [AtlasContractErrorCode.CONTRACT_INVALID_JSON]: DoctorDiagnosticCode.CONTRACT_INVALID,
  [AtlasContractErrorCode.CONTRACT_VALIDATION_FAILED]: DoctorDiagnosticCode.CONTRACT_INVALID,
  [AtlasContractErrorCode.CONTRACT_UNSUPPORTED_VERSION]: DoctorDiagnosticCode.CONTRACT_UNSUPPORTED,
  [AtlasContractErrorCode.CONTRACT_STRUCTURE_INVALID]: DoctorDiagnosticCode.CONTRACT_INVALID,
};

function extractPathFromDetail(detail: string): string | undefined {
  const match =
    detail.match(/\(([^)]+)\)/)?.[1] ??
    detail.match(/:\n([^\n]+)/)?.[1] ??
    detail.match(/:\s+([^\s]+)$/)?.[1];

  if (!match || match.includes(" ")) {
    return undefined;
  }

  return match.replace(/\\/g, "/");
}

export function mapContractErrorToDiagnostics(error: AtlasContractError): DoctorDiagnostic[] {
  const code = CONTRACT_CODE_MAP[error.code] ?? DoctorDiagnosticCode.CONTRACT_INVALID;
  const diagnostics: DoctorDiagnostic[] = [
    createDiagnostic(code, error.message.split("\n")[0] ?? error.message),
  ];

  if (error.details?.length) {
    for (const detail of error.details) {
      diagnostics.push(
        createDiagnostic(code, detail, {
          path: extractPathFromDetail(detail),
        })
      );
    }
  }

  return dedupeDiagnostics(diagnostics);
}

function dedupeDiagnostics(diagnostics: DoctorDiagnostic[]): DoctorDiagnostic[] {
  const seen = new Set<string>();
  const unique: DoctorDiagnostic[] = [];

  for (const diagnostic of diagnostics) {
    const key = [
      diagnostic.code,
      diagnostic.path ?? "",
      diagnostic.line ?? "",
      diagnostic.column ?? "",
      diagnostic.message,
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(diagnostic);
  }

  return unique;
}

export { dedupeDiagnostics };
