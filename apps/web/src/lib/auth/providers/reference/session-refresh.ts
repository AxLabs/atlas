/**
 * Reference provider session helpers.
 *
 * Reference sessions use deterministic long-lived tokens — no external refresh.
 *
 * @module lib/auth/providers/reference/session-refresh
 */

import "server-only";

import { enrichSessionResponse } from "@/lib/authz/session-response";

import { readSession } from "../../session";

import type { SessionData, SessionResponse } from "../../types";

/**
 * Reference sessions do not require external token refresh.
 */
export async function refreshReferenceSession(session: SessionData): Promise<SessionData> {
  if (session.user.provider !== "reference") {
    throw new Error(`Expected reference provider, got: ${session.user.provider}`);
  }

  return session;
}

/**
 * Session response for `/api/auth/me` for reference-authenticated users.
 */
export async function getReferenceSessionResponse(): Promise<SessionResponse> {
  const session = await readSession();

  if (!session || session.user.provider !== "reference") {
    return { authenticated: false };
  }

  return enrichSessionResponse(session);
}
