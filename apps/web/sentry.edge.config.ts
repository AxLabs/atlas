/**
 * Sentry Edge Configuration
 *
 * This file configures Sentry for the Edge runtime (middleware, edge API routes).
 * Edge runtime has different constraints than Node.js (e.g., no fs, limited APIs).
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
 */

import * as Sentry from "@sentry/nextjs";

// Gracefully handle missing env vars
const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV;
const SENTRY_RELEASE = process.env.SENTRY_RELEASE;

// Determine sample rates based on environment
const getSampleRates = () => {
  switch (SENTRY_ENVIRONMENT) {
    case "production":
      return {
        tracesSampleRate: 0.1, // 10% of transactions
      };
    case "staging":
      return {
        tracesSampleRate: 0.3, // 30% for better diagnosis
      };
    default: // development
      return {
        tracesSampleRate: 0, // Disabled by default in dev
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

    // Customize error processing
    beforeSend(event) {
      // Add runtime tag
      event.tags = {
        ...event.tags,
        runtime: "edge",
      };

      // Don't send events in development unless explicitly enabled
      if (SENTRY_ENVIRONMENT === "development" && !process.env.SENTRY_ENABLE_IN_DEV) {
        return null;
      }

      return event;
    },

    // Enable debug mode in development
    debug: SENTRY_ENVIRONMENT === "development",
  });
}
