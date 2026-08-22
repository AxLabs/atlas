/**
 * Reference harness resource policy demonstration.
 *
 * Further restricts already-granted global permissions for specific resources.
 * Not a general policy engine — deterministic rules for the reference harness.
 *
 * @module lib/reference/auth/policy
 */

import "server-only";

import { permissions } from "@/lib/authz/permissions";
import { registerResourcePolicy } from "@/lib/authz/policy";

import { PROTECTED_REFERENCE_USER_ID } from "./personas";

import type { ResourcePolicyContext } from "@/lib/authz/policy";

/**
 * Reference-only resource restriction — scoped to reference principals only.
 */
export function referenceResourcePolicy({
  principal,
  resourceType,
  resourceId,
  action,
}: ResourcePolicyContext): boolean {
  if (principal.provider !== "reference") {
    return true;
  }

  if (resourceType !== "users" || action !== permissions.users.update) {
    return true;
  }

  if (resourceId === PROTECTED_REFERENCE_USER_ID) {
    return false;
  }

  return true;
}

/**
 * Register the reference resource policy seam demonstration.
 */
export function registerReferenceResourcePolicy(): void {
  registerResourcePolicy("reference", referenceResourcePolicy);
}
