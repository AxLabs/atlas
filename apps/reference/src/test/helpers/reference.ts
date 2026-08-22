/**
 * Test helper for configuring reference harness scenarios.
 *
 * @module test/helpers/reference
 */

import type { ReferenceScenarioState } from "@/lib/reference/scenario-types";

export interface ReferenceScenarioOptions {
  auth?: ReferenceScenarioState["auth"];
  users?: ReferenceScenarioState["users"];
}

/**
 * Build a reference scenario payload for API calls and Playwright setup.
 */
export function referenceScenario(options: ReferenceScenarioOptions): ReferenceScenarioState {
  return {
    ...(options.auth ? { auth: options.auth } : {}),
    ...(options.users ? { users: options.users } : {}),
  };
}

/**
 * Serialize scenario for the x-atlas-reference-scenario header.
 */
export function referenceScenarioHeader(options: ReferenceScenarioOptions): string {
  return JSON.stringify(referenceScenario(options));
}
