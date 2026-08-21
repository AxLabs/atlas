/**
 * Register the reference harness permission resolver.
 *
 * Called from `@/lib/authz/setup` — do not import this module for side effects.
 *
 * @module lib/reference/auth/register
 */

import "server-only";

import { registerPermissionResolver } from "@/lib/authz/resolvers";

import { resolveReferencePermissions } from "./permissions";

/**
 * Register the reference persona → permission mapping resolver.
 * Idempotent via named resolver registration.
 */
export function registerReferenceAuthz(): void {
  registerPermissionResolver("reference", ({ principal, user }) => {
    if (user.provider !== "reference") {
      return [];
    }

    return resolveReferencePermissions(principal);
  });
}
