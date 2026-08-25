/**
 * Safe platform runtime diagnostics for the reference application.
 */

import { NextResponse } from "next/server";

import { getSafePlatformRuntime, getSafeSecuritySummary } from "@/lib/reference/platform-runtime";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    runtime: getSafePlatformRuntime(),
    security: getSafeSecuritySummary(),
  });
}
