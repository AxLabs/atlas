/**
 * Reset deterministic reference state (this browser's users store and scenario cookie).
 *
 * @module api/reference/reset
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { assertReferenceModeEnabled } from "@/lib/reference/mode";
import { REFERENCE_SCENARIO_COOKIE } from "@/lib/reference/scenario";
import { resetReferenceUsersStoreForRequest } from "@/lib/reference/users/store-scope";

export async function POST(): Promise<NextResponse> {
  try {
    assertReferenceModeEnabled();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reference mode unavailable";
    return NextResponse.json({ code: "REFERENCE_MODE_DISABLED", message }, { status: 403 });
  }

  await resetReferenceUsersStoreForRequest();

  const cookieStore = await cookies();
  cookieStore.set(REFERENCE_SCENARIO_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return NextResponse.json({ reset: true });
}
