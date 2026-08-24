"use client";

/**
 * Global Error Boundary
 *
 * Catches catastrophic errors that occur outside of the normal component tree,
 * including errors in the root layout itself.
 *
 * This is a special Next.js error file that:
 * - Wraps the entire application
 * - Must be a client component
 * - Must define its own <html> and <body> tags
 * - Is used when the root layout fails
 *
 * Providers from the root layout may be unavailable, but Atlas UI primitives and
 * theme tokens are safe to use here.
 */

import "@atlas/ui/globals.css";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { ErrorFallback } from "@atlas/ui";
import { getThemeBootScriptContent } from "@atlas/ui/theme-boot";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: getThemeBootScriptContent(),
          }}
        />
      </head>
      <body className="bg-background text-foreground font-sans antialiased">
        <div className="flex min-h-screen items-center justify-center p-4">
          <ErrorFallback
            title="Something went wrong"
            description="We encountered an unexpected error. Please try refreshing the page."
            correlationId={error.digest}
            onRetry={reset}
          />
        </div>
      </body>
    </html>
  );
}
