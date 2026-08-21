/**
 * Pure permission check helpers.
 *
 * @module lib/authz/check
 */

import type { AuthorizationContext } from "./context";
import type { Permission } from "./permissions";

/**
 * Check whether an authorization context grants a permission.
 */
export function hasPermission(ctx: AuthorizationContext, permission: Permission): boolean {
  return ctx.permissions.includes(permission);
}

/**
 * Alias for hasPermission — reads naturally in guard expressions.
 */
export function can(ctx: AuthorizationContext, permission: Permission): boolean {
  return hasPermission(ctx, permission);
}
