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
import { readSession } from "@/lib/auth/session";

export async function GET() {
  const session = await readSession();

  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json(await getGoogleSessionResponse());
}
