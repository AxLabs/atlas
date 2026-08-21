/**
 * Reference role → permission adapter.
 *
 * Reference profile metadata (roles) maps into the core permission model here.
 * Application code must not check reference roles directly.
 *
 * @module lib/reference/auth/permissions
 */

import { type Permission, permissions } from "@/lib/authz/permissions";

import { getReferencePersona } from "./personas";

import type { Principal } from "@/lib/authz/principal";

/** Deterministic mapping from reference profile roles to typed permissions. */
const REFERENCE_ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  user: [permissions.users.read],
  admin: [
    permissions.users.read,
    permissions.users.create,
    permissions.users.update,
    permissions.users.delete,
  ],
};

/**
 * Resolve permissions for a reference harness principal.
 * Returns empty when the principal is not a known reference persona.
 */
export function resolveReferencePermissions(principal: Principal): readonly Permission[] {
  const persona = getReferencePersona(principal.id as "reference-user" | "reference-admin");

  if (!persona) {
    return [];
  }

  const granted = new Set<Permission>();

  for (const role of persona.roles) {
    const rolePermissions = REFERENCE_ROLE_PERMISSIONS[role];
    if (rolePermissions) {
      for (const permission of rolePermissions) {
        granted.add(permission);
      }
    }
  }

  return [...granted];
}

/**
 * Exposed for tests — deterministic role mapping without persona lookup.
 */
export function referenceRolesToPermissions(roles: readonly string[]): readonly Permission[] {
  const granted = new Set<Permission>();

  for (const role of roles) {
    const rolePermissions = REFERENCE_ROLE_PERMISSIONS[role];
    if (rolePermissions) {
      for (const permission of rolePermissions) {
        granted.add(permission);
      }
    }
  }

  return [...granted];
}
