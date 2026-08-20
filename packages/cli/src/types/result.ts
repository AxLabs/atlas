import type { CliErrorCode } from "../errors/cli-error";

export type PlannedActionKind = "create" | "skip" | "remove" | "copy" | "conflict";

export interface PlannedAction {
  kind: PlannedActionKind;
  path: string;
  reason?: string;
}

export interface CommandWarning {
  code: string;
  message: string;
}

export interface CommandResult {
  repoRoot: string;
  atlasVersion: string;
  actions: PlannedAction[];
  warnings: CommandWarning[];
  alreadyInitialized?: boolean;
  referencePolicy?: "keep" | "remove";
}

export interface JsonErrorBody {
  code: CliErrorCode;
  message: string;
  details?: string[];
}

export interface JsonSuccessEnvelope<T> {
  ok: true;
  command: string;
  result: T;
}

export interface JsonErrorEnvelope {
  ok: false;
  command: string;
  error: JsonErrorBody;
}

export type JsonEnvelope<T> = JsonSuccessEnvelope<T> | JsonErrorEnvelope;
