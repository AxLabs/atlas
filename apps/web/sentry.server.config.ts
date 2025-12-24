/**
 * Sentry Server Configuration
 *
 * This file configures Sentry for the server-side (Node.js) runtime.
 * It captures errors from:
 * - Server components
 * - API route handlers
 * - Server actions
 * - Middleware
 * - getServerSideProps / generateMetadata / etc.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
 */

import * as Sentry from "@sentry/nextjs";

import { serverEnv } from "@/env";

// Gracefully handle missing env vars
const SENTRY_DSN = serverEnv.SENTRY_DSN;
const SENTRY_ENVIRONMENT = serverEnv.SENTRY_ENVIRONMENT ?? serverEnv.NODE_ENV;
const SENTRY_RELEASE = serverEnv.SENTRY_RELEASE;

// Determine sample rates based on environment
const getSampleRates = () => {
  switch (SENTRY_ENVIRONMENT) {
    case "production":
      return {
        tracesSampleRate: 0.1, // 10% of transactions
        profilesSampleRate: 0, // Profiling disabled by default (expensive)
      };
    case "staging":
      return {
        tracesSampleRate: 0.3, // 30% for better diagnosis
        profilesSampleRate: 0, // Can enable if needed: 0.1
      };
    default: // development
      return {
        tracesSampleRate: 0, // Disabled by default in dev
        profilesSampleRate: 0,
      };
  }
};

const sampleRates = getSampleRates();

// Only initialize Sentry if DSN is provided
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE,

    // Performance Monitoring
    tracesSampleRate: sampleRates.tracesSampleRate,

    // Profiling (disabled by default - enable if needed)
    profilesSampleRate: sampleRates.profilesSampleRate,

    // Integration configuration
    integrations: [
      // Automatically instrument Node.js libraries
      Sentry.httpIntegration(),
    ],

    // Filter out known expected errors
    ignoreErrors: [
      // Expected validation errors
      "ValidationError",
      "ZodError",
    ],

    // Customize error processing
    beforeSend(event) {
      // Add runtime tag
      event.tags = {
        ...event.tags,
        runtime: "server",
      };

      // Don't send events in development unless explicitly enabled
      if (SENTRY_ENVIRONMENT === "development" && !serverEnv.SENTRY_ENABLE_IN_DEV) {
        return null;
      }

      return event;
    },

    // Enable debug mode in development
    debug: SENTRY_ENVIRONMENT === "development",

    // Don't capture console logs as breadcrumbs in production (reduces noise)
    maxBreadcrumbs: SENTRY_ENVIRONMENT === "production" ? 50 : 100,
  });
}
