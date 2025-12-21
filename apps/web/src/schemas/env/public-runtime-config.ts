/**
 * Client-side environment variables schema.
 *
 * Defines validation rules for public NEXT_PUBLIC_* variables
 * that are safe to expose to the browser.
 */

import { z } from "zod";

/**
 * Zod schema for validating public client-side environment variables.
 *
 * All variables defined here will be bundled into the client-side JavaScript
 * and visible to users. Only include non-sensitive configuration.
 */
export const ClientEnvSchema = {
  /**
   * Base API URL for client-side requests.
   * Used by fetch calls and HTTP clients in the browser.
   *
   * @example 'https://api.example.com', 'http://localhost:3001/api'
   */
  NEXT_PUBLIC_API_URL: z.string().url(),

  /**
   * Environment identifier for telemetry and feature flags.
   *
   * @example 'development', 'staging', 'production'
   */
  NEXT_PUBLIC_APP_ENV: z.enum(["development", "staging", "production"]).optional(),

  /**
   * Build ID or Git SHA for version tracking.
   *
   * @example 'abc123def', 'v1.2.3'
   */
  NEXT_PUBLIC_BUILD_ID: z.string().optional(),

  /**
   * Enable/disable Web Vitals reporting.
   *
   * @default Enabled in production/staging, disabled in development
   */
  NEXT_PUBLIC_WEB_VITALS_ENABLED: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),

  /**
   * Web Vitals sampling rate (0-1).
   *
   * @default 0.05 (5%) in production, 0.25 (25%) in staging
   */
  NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE: z
    .string()
    .regex(/^(0|1|0\.\d+)$/)
    .transform(Number)
    .optional(),

  /**
   * Web Vitals endpoint override.
   *
   * @default '/api/telemetry/web-vitals'
   */
  NEXT_PUBLIC_WEB_VITALS_ENDPOINT: z.string().optional(),

  /**
   * Enable debug logging for Web Vitals.
   *
   * @default false
   */
  NEXT_PUBLIC_WEB_VITALS_DEBUG: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
};
