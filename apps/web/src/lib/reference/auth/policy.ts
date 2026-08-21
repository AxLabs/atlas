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

/**
 * Register the reference resource policy seam demonstration.
 */
export function registerReferenceResourcePolicy(): void {
  registerResourcePolicy(({ resourceType, resourceId, action }) => {
    if (resourceType !== "users" || action !== permissions.users.update) {
      return true;
    }

    if (resourceId === PROTECTED_REFERENCE_USER_ID) {
      return false;
    }

    return true;
  });
}
