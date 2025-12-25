/**
 * Runtime Configuration Schema
 *
 * Defines client-safe runtime configuration that is loaded dynamically
 * at runtime rather than being baked into the client bundle at build time.
 *
 * This enables "build once, deploy many" by allowing environment-specific
 * configuration to be injected at deployment time without rebuilding.
 *
 * @module runtime-config/schema
 */

import { z } from "zod";

/**
 * Runtime configuration schema.
 *
 * Only includes values that are:
 * 1. Safe to expose to the browser (no secrets)
 * 2. May vary between runtime environments
 * 3. Should not be baked into the client bundle at build time
 *
 * Examples: API URLs, feature flags, public telemetry endpoints
 */
export const runtimeConfigSchema = z.object({
  /**
   * Base API URL for client-side requests.
   * Used by fetch calls and HTTP clients in the browser.
   *
   * @example 'https://api.example.com', 'http://localhost:3001/api'
   */
  apiBaseUrl: z.string().url(),

  /**
   * Application URL (where the frontend is hosted).
   * Used for redirects, OAuth callbacks, and link generation.
   *
   * @example 'https://app.example.com', 'http://localhost:3000'
   */
  appUrl: z.string().url(),

  /**
   * Environment identifier for telemetry and feature flags.
   *
   * @example 'development', 'staging', 'production'
   */
  environment: z.enum(["development", "staging", "production"]),

  /**
   * Build ID or Git SHA for version tracking.
   *
   * @example 'abc123def', 'v1.2.3'
   */
  buildId: z.string().optional(),

  /**
   * Sentry DSN for client-side error tracking.
   * Optional - when not provided, Sentry is disabled gracefully.
   *
   * @security Public - will be visible in browser bundles
   * @example 'https://abc123@o123.ingest.sentry.io/456'
   */
  sentryDsn: z.string().url().optional(),

  /**
   * Sentry environment name.
   * Used to tag errors in Sentry for environment-based filtering.
   *
   * @example 'production' | 'staging' | 'development'
   */
  sentryEnvironment: z.string().optional(),

  /**
   * Sentry release identifier.
   * Used to track which version of code produced an error.
   *
   * @example 'my-app@1.0.0' | 'abc123def456' (git SHA)
   */
  sentryRelease: z.string().optional(),

  /**
   * Web Vitals configuration.
   */
  webVitals: z
    .object({
      /**
       * Enable/disable Web Vitals reporting.
       * @default false in development, true in staging/production
       */
      enabled: z.boolean(),

      /**
       * Web Vitals sampling rate (0-1).
       * @default 0.05 (5%) in production, 0.25 (25%) in staging
       */
      sampleRate: z.number().min(0).max(1),

      /**
       * Web Vitals endpoint.
       * @default '/api/telemetry/web-vitals'
       */
      endpoint: z.string(),

      /**
       * Enable debug logging for Web Vitals.
       * @default false
       */
      debug: z.boolean(),
    })
    .optional(),

  /**
   * Feature flags for runtime behavior control.
   * Each key is a feature name, each value is a boolean toggle.
   *
   * @example { newDashboard: true, betaFeatures: false }
   */
  featureFlags: z.record(z.string(), z.boolean()).optional(),
});

/**
 * Inferred TypeScript type for runtime configuration.
 * Use this type when consuming runtime config in components.
 */
export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;
