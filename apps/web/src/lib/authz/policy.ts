/**
 * Consumer-supplied resource policy seam.
 *
 * Global capability checks are typed centrally; resource ownership and domain
 * policy can remain with the application or backend via this extension point.
 *
 * @module lib/authz/policy
 */

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
 * Evaluate consumer resource policy when global permissions are insufficient.
 * Returns false when no policy is registered.
 */
export async function evaluateResourcePolicy(ctx: ResourcePolicyContext): Promise<boolean> {
  if (!resourcePolicy) {
    return false;
  }

  return resourcePolicy(ctx);
}

/**
 * Check whether a principal may perform an action on a specific resource,
 * deferring to the consumer policy when registered.
 */
export async function canOnResource(
  principal: Principal,
  action: Permission,
  resourceType: string,
  resourceId?: string
): Promise<boolean> {
  return evaluateResourcePolicy({
    principal,
    action,
    resourceType,
    resourceId,
  });
}
