"use client";

/**
 * Client hook for permission-based UI gating.
 *
 * **Client-side authorization controls presentation only. It is not a security boundary.**
 * Server enforcement via `@/lib/authz/server` is required for all protected actions.
 *
 * @module lib/authz/client/usePermission
 */

import { useSession } from "@/lib/auth";

import type { Permission } from "../permissions";

/**
 * Returns whether the current session grants a permission (for UI gating only).
 */
export function usePermission(permission: Permission): boolean {
  const { status, permissions } = useSession();

  if (status !== "authenticated" || !permissions) {
    return false;
  }

  return permissions.includes(permission);
}
