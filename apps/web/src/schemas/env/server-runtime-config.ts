/**
 * Server-only environment variables schema.
 *
 * Defines validation rules for sensitive server-side variables
 * that should never be exposed to the client.
 */

import { z } from "zod";

/**
 * Zod schema for validating server-only environment variables.
 *
 * These values are pulled from process.env and validated on app startup.
 * They are kept strictly on the server side and never exposed to the client.
 */
export const ServerEnvSchema = {
  /**
   * Node environment for server-side logic.
   * Determines application behavior and security settings.
   *
   * @default 'development'
   * @example 'production' | 'development' | 'test'
   */
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /**
   * Database connection URL.
   * Used to connect to your database (PostgreSQL, MySQL, etc.)
   *
   * @security Keep this secret secure - never expose to client
   * @example 'postgresql://user:password@localhost:5432/dbname'
   */
  DATABASE_URL: z.string().url(),

  /**
   * Sentry DSN for server-side error tracking.
   * Optional - when not provided, Sentry is disabled gracefully.
   *
   * @security Server-only - do not expose to client
   * @example 'https://abc123@o123.ingest.sentry.io/456'
   */
  SENTRY_DSN: z.string().url().optional(),

  /**
   * Sentry environment name.
   * Falls back to NODE_ENV if not specified.
   *
   * @example 'production' | 'staging' | 'development'
   */
  SENTRY_ENVIRONMENT: z.string().optional(),

  /**
   * Sentry release identifier.
   * Used to track which version of code produced an error.
   *
   * @example 'my-app@1.0.0' | 'abc123def456' (git SHA)
   */
  SENTRY_RELEASE: z.string().optional(),

  /**
   * Sentry auth token for uploading sourcemaps.
   * Only needed for CI/CD builds that upload sourcemaps.
   *
   * @security Keep this secret secure - CI/CD only
   */
  SENTRY_AUTH_TOKEN: z.string().optional(),

  /**
   * Sentry organization slug.
   * Only needed for CI/CD builds that upload sourcemaps.
   *
   * @example 'my-company'
   */
  SENTRY_ORG: z.string().optional(),

  /**
   * Sentry project slug.
   * Only needed for CI/CD builds that upload sourcemaps.
   *
   * @example 'my-project'
   */
  SENTRY_PROJECT: z.string().optional(),

  /**
   * Enable Sentry in development mode.
   * By default, Sentry is disabled in development even if DSN is set.
   *
   * @default undefined (disabled)
   * @example 'true'
   */
  SENTRY_ENABLE_IN_DEV: z.string().optional(),
};
