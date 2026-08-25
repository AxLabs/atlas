/**
 * Shared reference scenario types and pure helpers.
 *
 * @module lib/reference/scenario-types
 */

/** Deterministic auth personas for the reference harness. */
export type ReferenceAuthPersona = "anonymous" | "reference-user" | "reference-admin";

/** Deterministic API scenarios for reference resources. */
export type ReferenceUsersScenario =
  | "success"
  | "empty"
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "server-error"
  | "slow"
  | "offline";

export interface ReferenceScenarioState {
  auth?: ReferenceAuthPersona;
  users?: ReferenceUsersScenario;
}

export const REFERENCE_SCENARIO_COOKIE = "atlas_reference_scenario";
export const REFERENCE_SCENARIO_HEADER = "x-atlas-reference-scenario";

const VALID_AUTH_PERSONAS: ReferenceAuthPersona[] = [
  "anonymous",
  "reference-user",
  "reference-admin",
];

const VALID_USERS_SCENARIOS: ReferenceUsersScenario[] = [
  "success",
  "empty",
  "validation",
  "unauthorized",
  "forbidden",
  "server-error",
  "slow",
  "offline",
];

/**
 * Build a cookie value for persisting scenario state.
 */
export function serializeReferenceScenario(state: ReferenceScenarioState): string {
  return JSON.stringify(state);
}

/**
 * Validate and normalize scenario configuration (for API input).
 */
export function normalizeReferenceScenario(input: ReferenceScenarioState): ReferenceScenarioState {
  const normalized: ReferenceScenarioState = {};

  if (input.auth && VALID_AUTH_PERSONAS.includes(input.auth)) {
    normalized.auth = input.auth;
  }

  if (input.users && VALID_USERS_SCENARIOS.includes(input.users)) {
    normalized.users = input.users;
  }

  return normalized;
}

export function parseScenarioPayload(raw: string): ReferenceScenarioState {
  const trimmed = raw.trim();

  if (!trimmed) {
    return {};
  }

  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed) as ReferenceScenarioState;
    } catch {
      return {};
    }
  }

  if (VALID_USERS_SCENARIOS.includes(trimmed as ReferenceUsersScenario)) {
    return { users: trimmed as ReferenceUsersScenario };
  }

  return {};
}
