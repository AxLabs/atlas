/**
 * Central scenario resolution for reference auth and API harness.
 *
 * @module lib/reference/scenario
 */

import "server-only";

import { cookies } from "next/headers";

import {
  parseScenarioPayload,
  REFERENCE_SCENARIO_COOKIE,
  REFERENCE_SCENARIO_HEADER,
} from "./scenario-types";

import type {
  ReferenceAuthPersona,
  ReferenceScenarioState,
  ReferenceUsersScenario,
} from "./scenario-types";
import type { NextRequest } from "next/server";

export type {
  ReferenceAuthPersona,
  ReferenceScenarioState,
  ReferenceUsersScenario,
} from "./scenario-types";
export {
  normalizeReferenceScenario,
  REFERENCE_SCENARIO_COOKIE,
  REFERENCE_SCENARIO_HEADER,
  serializeReferenceScenario,
} from "./scenario-types";

const DEFAULT_USERS_SCENARIO: ReferenceUsersScenario = "success";

function isReferenceAuthPersona(value: string): value is ReferenceAuthPersona {
  return value === "anonymous" || value === "reference-user" || value === "reference-admin";
}

function isReferenceUsersScenario(value: string): value is ReferenceUsersScenario {
  return (
    value === "success" ||
    value === "empty" ||
    value === "validation" ||
    value === "unauthorized" ||
    value === "forbidden" ||
    value === "server-error" ||
    value === "slow" ||
    value === "offline"
  );
}

/**
 * Resolve scenario state from request headers, query params, and cookies.
 */
export async function resolveReferenceScenario(
  request?: NextRequest
): Promise<ReferenceScenarioState> {
  const state: ReferenceScenarioState = {};

  if (request) {
    const headerValue = request.headers.get(REFERENCE_SCENARIO_HEADER);
    if (headerValue) {
      Object.assign(state, parseScenarioPayload(headerValue));
    }

    const queryScenario = request.nextUrl.searchParams.get("scenario");
    if (queryScenario && isReferenceUsersScenario(queryScenario)) {
      state.users = queryScenario;
    }

    const queryAuth = request.nextUrl.searchParams.get("auth");
    if (queryAuth && isReferenceAuthPersona(queryAuth)) {
      state.auth = queryAuth;
    }
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(REFERENCE_SCENARIO_COOKIE)?.value;
  if (cookieValue) {
    Object.assign(state, parseScenarioPayload(cookieValue));
  }

  return state;
}

/**
 * Resolve the users API scenario with a deterministic default.
 */
export async function resolveUsersScenario(request?: NextRequest): Promise<ReferenceUsersScenario> {
  const state = await resolveReferenceScenario(request);
  return state.users ?? DEFAULT_USERS_SCENARIO;
}
