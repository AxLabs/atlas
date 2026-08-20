/**
 * Global error handler for unhandled promise rejections.
 *
 * Mounted in the root layout when Sentry is enabled (NEXT_PUBLIC_SENTRY_DSN).
 * Component-level error boundaries use Sentry's ErrorBoundary from @sentry/nextjs
 * directly or via global-error.tsx for catastrophic failures.
 */

"use client";

import { useEffect } from "react";

const SENTRY_ENABLED = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

export function GlobalErrorHandler() {
  useEffect(() => {
    if (!SENTRY_ENABLED) return;

    let cleanup: (() => void) | undefined;

    void import("@sentry/nextjs").then((Sentry) => {
      const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        Sentry.captureException(event.reason, {
          tags: { errorType: "unhandledRejection" },
        });
      };

      window.addEventListener("unhandledrejection", handleUnhandledRejection);
      cleanup = () => window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    });

    return () => cleanup?.();
  }, []);

  return null;
}
