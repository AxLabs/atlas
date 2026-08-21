/**
 * Session Information Handler
 *
 * Returns current session status and user information.
 * Does NOT return tokens - only safe user data.
 *
 * @route GET /api/auth/me
 */

import "@/lib/reference/auth/register";

import { NextResponse } from "next/server";

import { getGoogleSessionResponse } from "@/lib/auth/providers/google/session-refresh";
import { getReferenceSessionResponse } from "@/lib/auth/providers/reference/session-refresh";
import { readSession } from "@/lib/auth/session";

export async function GET() {
  const session = await readSession();

  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  if (session.user.provider === "reference") {
    return NextResponse.json(await getReferenceSessionResponse());
  }

  return NextResponse.json(await getGoogleSessionResponse());
}
