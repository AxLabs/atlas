/**
 * Consumer-supplied resource policy seam.
 *
 * Global capability checks are typed centrally; resource ownership and domain
 * policy can further restrict already-granted permissions via this extension point.
 *
 * @module lib/authz/policy
 */

import { hasPermission } from "./check";

import type { AuthorizationContext } from "./context";
import type { Permission } from "./permissions";
import type { Principal } from "./principal";

export interface ResourcePolicyContext {
  principal: Principal;
  resourceType: string;
  resourceId?: string;
  action: Permission;
}

export type ResourcePolicyFn = (ctx: ResourcePolicyContext) => boolean | Promise<boolean>;

let resourcePolicy: ResourcePolicyFn | null = null;

/**
 * Register a consumer-supplied resource policy function.
 * Call once at application bootstrap — not a generic policy engine.
 */
export function registerResourcePolicy(fn: ResourcePolicyFn): void {
  resourcePolicy = fn;
}

/**
 * Reset the resource policy (for tests).
 */
export function resetResourcePolicy(): void {
  resourcePolicy = null;
}

/**
 * Whether a consumer resource policy is registered.
 */
export function hasRegisteredResourcePolicy(): boolean {
  return resourcePolicy !== null;
}

/**
 * Evaluate the registered consumer resource policy.
 * Returns false when no policy is registered.
 */
export async function evaluateResourcePolicy(ctx: ResourcePolicyContext): Promise<boolean> {
  if (!resourcePolicy) {
    return false;
  }

  return resourcePolicy(ctx);
}

/**
 * Complete authorization decision for an action on a specific resource:
 * global typed permission first, then optional consumer resource policy.
 *
 * When no resource policy is registered, a granted global permission is sufficient.
 */
export async function canOnResource(
  ctx: AuthorizationContext,
  action: Permission,
  resourceType: string,
  resourceId?: string
): Promise<boolean> {
  if (!hasPermission(ctx, action)) {
    return false;
  }

  if (!resourcePolicy) {
    return true;
  }

  return evaluateResourcePolicy({
    principal: ctx.principal,
    action,
    resourceType,
    resourceId,
  });
}
