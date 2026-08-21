/**
 * Permission resolver registry.
 *
 * Provider-specific adapters (e.g. reference harness) register here.
 * Core authz does not import reference modules directly.
 *
 * @module lib/authz/resolvers
 */

import type { Permission } from "./permissions";
import type { Principal } from "./principal";
import type { OAuthUser } from "@/lib/auth/types";

export interface PermissionResolverContext {
  principal: Principal;
  user: OAuthUser;
}

export type PermissionResolver = (ctx: PermissionResolverContext) => readonly Permission[];

const resolvers: PermissionResolver[] = [];

/**
 * Register a permission resolver (reference adapter, consumer mapping, etc.).
 */
export function registerPermissionResolver(resolver: PermissionResolver): void {
  resolvers.push(resolver);
}

/** Reset resolvers (for tests). */
export function resetPermissionResolvers(): void {
  resolvers.length = 0;
}

/**
 * Resolve all permissions from registered resolvers.
 */
export function resolveAllPermissions(ctx: PermissionResolverContext): readonly Permission[] {
  const granted = new Set<Permission>();

  for (const resolver of resolvers) {
    for (const permission of resolver(ctx)) {
      granted.add(permission);
    }
  }

  return [...granted];
}
