/**
 * Server-side authorization enforcement.
 *
 * The authoritative security boundary for Atlas frontend routes and API handlers.
 *
 * @module lib/authz/server
 */

import "server-only";

import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";

import { logAuthorizationDenied } from "./audit";
import { can } from "./check";
import { resolveAuthorizationContext } from "./context";
import { AuthenticationRequiredError, PermissionDeniedError } from "./errors";
import { principalFromUser } from "./principal";

import type { AuthorizationContext } from "./context";
import type { Permission } from "./permissions";
import type { Principal } from "./principal";
import type { components } from "@/lib/api/contracts";

type ApiError = components["schemas"]["ApiError"];

/**
 * Require an authenticated principal or throw AuthenticationRequiredError.
 */
export async function requirePrincipal(): Promise<Principal> {
  const session = await getServerSession();

  if (!session) {
    throw new AuthenticationRequiredError();
  }

  return principalFromUser(session.user);
}

/**
 * Require an authenticated authorization context or throw AuthenticationRequiredError.
 */
export async function requireAuthorizationContext(): Promise<AuthorizationContext> {
  const session = await getServerSession();

  if (!session) {
    throw new AuthenticationRequiredError();
  }

  return resolveAuthorizationContext(session.user);
}

/**
 * Authorize a permission against an existing context (throws PermissionDeniedError).
 */
export function authorize(
  ctx: AuthorizationContext,
  permission: Permission,
  options?: { resourceType?: string; resourceId?: string; correlationId?: string }
): void {
  if (can(ctx, permission)) {
    return;
  }

  logAuthorizationDenied({
    principalId: ctx.principal.id,
    permission,
    resourceType: options?.resourceType,
    resourceId: options?.resourceId,
    result: "denied",
    correlationId: options?.correlationId,
  });

  throw new PermissionDeniedError(permission);
}

/**
 * Require authentication and a specific permission.
 * Throws AuthenticationRequiredError (401) or PermissionDeniedError (403).
 */
export async function requirePermission(
  permission: Permission,
  options?: { resourceType?: string; resourceId?: string; correlationId?: string }
): Promise<AuthorizationContext> {
  const ctx = await requireAuthorizationContext();
  authorize(ctx, permission, options);
  return ctx;
}

/**
 * Map authorization errors to standard API responses.
 * Returns null when the error is not an authz error.
 */
export function authorizationErrorResponse(
  error: unknown,
  correlationId: string
): NextResponse<ApiError> | null {
  if (error instanceof AuthenticationRequiredError) {
    return NextResponse.json<ApiError>(
      {
        code: "UNAUTHORIZED",
        message: error.message,
        userMessage: "Please log in to continue.",
        correlationId,
      },
      { status: 401 }
    );
  }

  if (error instanceof PermissionDeniedError) {
    return NextResponse.json<ApiError>(
      {
        code: "FORBIDDEN",
        message: error.message,
        userMessage: "You don't have permission to perform this action.",
        correlationId,
      },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Wrap an async handler with permission enforcement.
 */
export async function withPermission<T>(
  permission: Permission,
  handler: (ctx: AuthorizationContext) => Promise<T>,
  options?: { resourceType?: string; resourceId?: string; correlationId?: string }
): Promise<T> {
  const ctx = await requirePermission(permission, options);
  return handler(ctx);
}
