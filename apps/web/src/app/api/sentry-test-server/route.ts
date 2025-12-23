/**
 * Sentry Test Route - Server-Side Error
 *
 * This route handler is used to test Sentry server-side error capture.
 * It should only be enabled in development/staging environments.
 *
 * To test:
 * 1. Ensure SENTRY_DSN is set
 * 2. Visit /api/sentry-test-server
 * 3. Check Sentry dashboard for the error
 */

import { NextResponse } from "next/server";

import { captureException } from "@/lib/telemetry/sentry.server";

export const dynamic = "force-dynamic";

export async function GET() {
  // Only allow in non-production environments
  if (process.env.NODE_ENV === "production" && process.env.SENTRY_ENVIRONMENT === "production") {
    return NextResponse.json(
      {
        error: "Sentry test endpoints are disabled in production",
      },
      { status: 403 }
    );
  }

  try {
    // Intentionally throw an error for testing
    throw new Error("Sentry server-side test error - this is intentional");
  } catch (error) {
    // Capture the error
    if (error instanceof Error) {
      captureException(error, {
        tags: {
          testType: "server",
          route: "/api/sentry-test-server",
        },
        extra: {
          message: "This is a test error to verify Sentry integration",
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Test error captured and sent to Sentry",
        note: "Check your Sentry dashboard to verify the error was received",
      },
      { status: 200 }
    );
  }
}
