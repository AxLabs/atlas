/**
 * Register the reference harness permission resolver.
 *
 * Import this module from server entry points that exercise reference auth.
 *
 * @module lib/reference/auth/register
 */

import "server-only";

import { registerPermissionResolver } from "@/lib/authz/resolvers";

import { resolveReferencePermissions } from "./permissions";

registerPermissionResolver(({ principal, user }) => {
  if (user.provider !== "reference") {
    return [];
  }

  return resolveReferencePermissions(principal);
});
