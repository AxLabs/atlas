/**
 * Sentry Test Route — Server-Side Error
 *
 * Captures a test error directly via the Sentry SDK and flushes the
 * transport so we get a definitive yes/no on whether events reach Sentry.
 *
 * GET /api/sentry-test-server
 */

import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  // Block in production
  if (process.env.NODE_ENV === "production" && process.env.SENTRY_ENVIRONMENT === "production") {
    return NextResponse.json({ error: "Disabled in production" }, { status: 403 });
  }

  const dsn = process.env.SENTRY_DSN;
  const client = Sentry.getClient();

  if (!dsn || !client) {
    return NextResponse.json(
      {
        success: false,
        reason: !dsn ? "SENTRY_DSN not set" : "Sentry client not initialised",
        dsn: dsn ? "set" : "missing",
        clientInitialised: !!client,
      },
      { status: 500 }
    );
  }

  // Capture a known error
  const eventId = Sentry.captureException(
    new Error("Sentry server-side test error — this is intentional"),
    {
      tags: { testType: "server", route: "/api/sentry-test-server" },
      extra: { timestamp: new Date().toISOString() },
    }
  );

  // Flush the transport — returns true if all events were sent
  const flushed = await Sentry.flush(5000);

  return NextResponse.json({
    success: true,
    eventId,
    flushed,
    message: flushed
      ? "Event sent to Sentry successfully — check your dashboard"
      : "Flush timed out — event may not have been delivered",
  });
}
