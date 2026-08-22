/**
 * Sentry router transition handler — only bundled when NEXT_PUBLIC_SENTRY_DSN is set.
 */

import "./sentry.client.config";

import * as Sentry from "@sentry/nextjs";

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
