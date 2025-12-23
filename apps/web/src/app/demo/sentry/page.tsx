/**
 * Sentry Demo Page
 *
 * This page provides UI controls to test both client-side and server-side
 * Sentry error capture. Only accessible in non-production environments.
 */

"use client";

import { useState } from "react";

import { captureException, captureMessage } from "@/lib/telemetry/sentry.client";

export default function SentryDemoPage() {
  const [status, setStatus] = useState<string>("");

  // Only render in non-production
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === "production"
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="border-destructive bg-destructive/10 max-w-md rounded-lg border p-6">
          <h1 className="text-destructive text-xl font-semibold">Access Denied</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Sentry demo endpoints are disabled in production.
          </p>
        </div>
      </div>
    );
  }

  const testClientError = () => {
    try {
      throw new Error("Sentry client-side test error - this is intentional");
    } catch (error) {
      if (error instanceof Error) {
        captureException(error, {
          tags: {
            testType: "client",
          },
          extra: {
            message: "This is a test error to verify Sentry integration",
          },
        });
        setStatus("✅ Client error captured and sent to Sentry");
      }
    }
  };

  const testClientMessage = () => {
    captureMessage("Sentry client-side test message", "info", {
      tags: {
        testType: "client-message",
      },
    });
    setStatus("✅ Client message sent to Sentry");
  };

  const testServerError = async () => {
    try {
      // eslint-disable-next-line no-restricted-globals, no-restricted-syntax
      const response = await fetch("/api/sentry-test-server");
      const data = await response.json();
      setStatus(`✅ ${data.message}`);
    } catch {
      setStatus("❌ Failed to trigger server test");
    }
  };

  const testUnhandledError = () => {
    // This will trigger the global error handler
    setTimeout(() => {
      throw new Error("Unhandled error test - this is intentional");
    }, 100);
    setStatus("✅ Unhandled error triggered (check console and Sentry)");
  };

  return (
    <div className="bg-background min-h-screen p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Sentry Integration Demo</h1>
          <p className="text-muted-foreground mt-2">
            Test error capture and monitoring capabilities
          </p>
          {!process.env.NEXT_PUBLIC_SENTRY_DSN && (
            <div className="mt-4 rounded-lg border border-yellow-500 bg-yellow-50 p-4 dark:bg-yellow-950">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ NEXT_PUBLIC_SENTRY_DSN is not set. Errors will be logged but not sent to Sentry.
              </p>
            </div>
          )}
        </div>

        <div className="bg-card space-y-4 rounded-lg border p-6">
          <h2 className="text-xl font-semibold">Client-Side Tests</h2>

          <button
            onClick={testClientError}
            className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-md px-4 py-2"
          >
            Test Client Error Capture
          </button>

          <button
            onClick={testClientMessage}
            className="bg-secondary text-secondary-foreground hover:bg-secondary/90 w-full rounded-md px-4 py-2"
          >
            Test Client Message
          </button>

          <button
            onClick={testUnhandledError}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full rounded-md px-4 py-2"
          >
            Test Unhandled Error
          </button>
        </div>

        <div className="bg-card mt-6 space-y-4 rounded-lg border p-6">
          <h2 className="text-xl font-semibold">Server-Side Tests</h2>

          <button
            onClick={testServerError}
            className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-md px-4 py-2"
          >
            Test Server Error Capture
          </button>
        </div>

        {status && (
          <div className="bg-muted mt-6 rounded-lg border p-4">
            <p className="text-sm font-medium">{status}</p>
            <p className="text-muted-foreground mt-2 text-xs">
              Check your Sentry dashboard to verify the event was received with proper tags and
              context.
            </p>
          </div>
        )}

        <div className="bg-muted mt-8 rounded-lg border p-6">
          <h3 className="font-semibold">Expected Behavior:</h3>
          <ul className="text-muted-foreground mt-2 list-inside list-disc space-y-1 text-sm">
            <li>Each test should send an event to Sentry</li>
            <li>Events should include runtime tags (client/server)</li>
            <li>Events should include correlationId from request context</li>
            <li>Check Sentry dashboard for proper error grouping</li>
            <li>
              In development, events are blocked unless SENTRY_ENABLE_IN_DEV or
              NEXT_PUBLIC_SENTRY_ENABLE_IN_DEV is set
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
