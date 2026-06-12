/**
 * Next.js Client Instrumentation
 *
 * This file is automatically loaded by Next.js in the browser before any other client code.
 * Sentry is only loaded when NEXT_PUBLIC_SENTRY_DSN is configured at build time.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { onRouterTransitionStart as noopHandler } from "./sentry-instrumentation.noop";

function getRouterTransitionHandler(): typeof noopHandler {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    // Build-time branch: enabled module is tree-shaken when DSN is unset
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./sentry-instrumentation.enabled")
      .onRouterTransitionStart as typeof noopHandler;
  }
  return noopHandler;
}

export const onRouterTransitionStart = getRouterTransitionHandler();
