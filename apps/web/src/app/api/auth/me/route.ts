/**
 * Session Information Handler
 *
 * Returns current session status and user information.
 * Does NOT return tokens - only safe user data.
 *
 * @route GET /api/auth/me
 */

import { NextResponse } from "next/server";

import { getGoogleSessionResponse } from "@/lib/auth/providers/google/session-refresh";

export async function GET() {
  const session = await getGoogleSessionResponse();

  return NextResponse.json(session);
}
