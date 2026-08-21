/**
 * Application authorization composition boundary.
 *
 * Registers consumer-specific permission resolvers and resource policies once.
 * Server surfaces that resolve permissions call `ensureAuthzSetup()` — no
 * side-effect imports scattered across route handlers.
 *
 * @module lib/authz/setup
 */

import "server-only";

import { registerReferenceResourcePolicy } from "@/lib/reference/auth/policy";
import { registerReferenceAuthz } from "@/lib/reference/auth/register";

let initialized = false;

/**
 * Idempotent bootstrap for permission resolver and resource policy registration.
 * Safe to call from any server entry point that resolves authorization context.
 */
export function ensureAuthzSetup(): void {
  if (initialized) {
    return;
  }

  initialized = true;
  registerReferenceAuthz();
  registerReferenceResourcePolicy();
}

/** Reset bootstrap state (for tests). */
export function resetAuthzSetup(): void {
  initialized = false;
}
