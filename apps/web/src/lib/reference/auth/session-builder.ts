/**
 * Build SessionData for reference personas using the standard session contract.
 *
 * @module lib/reference/auth/session-builder
 */

import "server-only";

import { getReferencePersona } from "./personas";

import type { ReferenceAuthPersona } from "../scenario-types";
import type { SessionData } from "@/lib/auth/types";

/** Fixed epoch for deterministic token and session expiry in reference sessions. */
const REFERENCE_SESSION_EXPIRES_AT = 4_102_444_800; // 2100-01-01T00:00:00Z

/**
 * Build deterministic session data for a reference persona.
 */
export function buildReferenceSessionData(persona: ReferenceAuthPersona): SessionData | null {
  const user = getReferencePersona(persona);
  if (!user) {
    return null;
  }

  const now = 1_700_000_000; // Fixed timestamp for deterministic sessions

  return {
    user,
    accessToken: `reference-access-token-${user.principalId}`,
    refreshToken: `reference-refresh-token-${user.principalId}`,
    accessTokenExpiresAt: REFERENCE_SESSION_EXPIRES_AT,
    createdAt: now,
    expiresAt: REFERENCE_SESSION_EXPIRES_AT,
  };
}
