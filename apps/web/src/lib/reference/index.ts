/**
 * Reference harness — deterministic local auth and API adapters.
 *
 * @module lib/reference
 */

export { referenceRolesToPermissions, resolveReferencePermissions } from "./auth/permissions";
export type { ReferencePersona } from "./auth/personas";
export {
  getReferencePersona,
  listReferencePersonas,
  REFERENCE_PERSONA_IDS,
  REFERENCE_PERSONAS,
} from "./auth/personas";
export { buildReferenceSessionData } from "./auth/session-builder";
export {
  assertReferenceModeAllowedInEnvironment,
  assertReferenceModeEnabled,
  isReferenceModeEnabled,
  isReferenceModeRequested,
  ReferenceModeForbiddenError,
} from "./mode";
export {
  normalizeReferenceScenario,
  REFERENCE_SCENARIO_COOKIE,
  REFERENCE_SCENARIO_HEADER,
  resolveReferenceScenario,
  resolveUsersScenario,
  serializeReferenceScenario,
} from "./scenario";
export type {
  ReferenceAuthPersona,
  ReferenceScenarioState,
  ReferenceUsersScenario,
} from "./scenario-types";
export { resetReferenceUsersStore } from "./users/store";
