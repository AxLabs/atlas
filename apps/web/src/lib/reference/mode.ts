/**
 * Reference mode resolution and production safety guards.
 *
 * @module lib/reference/mode
 */

export {
  assertReferenceModeAllowedInEnvironment,
  assertReferenceModeEnabled,
  isReferenceModeEnabled,
  isReferenceModeRequested,
  ReferenceModeForbiddenError,
} from "@/config/reference";
