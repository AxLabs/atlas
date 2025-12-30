/**
 * Sentry Client Configuration
 *
 * This file configures Sentry for the client-side (browser) runtime.
 * It captures errors and performance data from React components, client-side navigation,
 * and browser interactions.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";

import { clientEnv } from "@/env";

// Gracefully handle missing env vars
const SENTRY_DSN = clientEnv.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENVIRONMENT = clientEnv.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV;
const SENTRY_RELEASE = clientEnv.NEXT_PUBLIC_SENTRY_RELEASE;

// Determine sample rates based on environment
const getSampleRates = () => {
  switch (SENTRY_ENVIRONMENT) {
    case "production":
      return {
        tracesSampleRate: 0.1, // 10% of transactions
        replaysSessionSampleRate: 0.01, // 1% of sessions
        replaysOnErrorSampleRate: 0.5, // 50% of sessions with errors
      };
    case "staging":
      return {
        tracesSampleRate: 0.3, // 30% for better diagnosis
        replaysSessionSampleRate: 0.05, // 5% of sessions
        replaysOnErrorSampleRate: 1.0, // 100% of error sessions
      };
    default: // development
      return {
        tracesSampleRate: 0, // Disabled by default in dev
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
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

    // Add request headers and IP for better error context
    sendDefaultPii: true,

    // Enable logs to be sent to Sentry
    enableLogs: true,

    // Performance Monitoring
    tracesSampleRate: sampleRates.tracesSampleRate,

    // Session Replay
    replaysSessionSampleRate: sampleRates.replaysSessionSampleRate,
    replaysOnErrorSampleRate: sampleRates.replaysOnErrorSampleRate,

    // Integration configuration
    integrations: [
      Sentry.browserTracingIntegration({
        // Trace client-side navigation and interactions
        enableInp: true, // Track Interaction to Next Paint
      }),
      Sentry.replayIntegration({
        // Privacy-focused replay settings
        maskAllText: false,
        blockAllMedia: true,
      }),
    ],

    // Filter out known noisy errors
    ignoreErrors: [
      // Browser extensions
      "top.GLOBALS",
      "chrome-extension://",
      "moz-extension://",
      // Common browser noise
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      // Network errors that are expected
      "NetworkError",
      "Failed to fetch",
      // Third-party script errors
      "Script error.",
    ],

    // Don't send errors from browser extensions
    denyUrls: [/extensions\//i, /^chrome:\/\//i, /^chrome-extension:\/\//i, /^moz-extension:\/\//i],

    // Customize error processing
    beforeSend(event) {
      // Add runtime tag
      event.tags = {
        ...event.tags,
        runtime: "client",
      };

      // Don't send events in development unless explicitly enabled
      if (SENTRY_ENVIRONMENT === "development" && !clientEnv.NEXT_PUBLIC_SENTRY_ENABLE_IN_DEV) {
        return null;
      }

      return event;
    },

    // Enable debug mode in development
    debug: SENTRY_ENVIRONMENT === "development",
  });
}
