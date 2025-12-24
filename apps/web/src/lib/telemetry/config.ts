/**
 * Web Vitals Configuration
 *
 * Production-grade configuration for Real User Monitoring (RUM) of Core Web Vitals.
 * This module provides type-safe configuration with environment-based defaults.
 */

import { clientEnv } from "@/env";

/**
 * Environment type for sampling and enablement logic
 */
type Environment = "development" | "staging" | "production" | "test";

/**
 * Web Vitals reporting configuration
 */
export interface WebVitalsConfig {
  /** Whether Web Vitals reporting is enabled */
  enabled: boolean;
  /** Sample rate (0-1). 0.05 = 5% of sessions */
  sampleRate: number;
  /** API endpoint to send vitals data */
  endpoint: string;
  /** Environment identifier */
  environment: Environment;
  /** Application identifier */
  appName: string;
  /** Build version/SHA (optional) */
  buildId?: string;
  /** Debug mode - logs to console instead of/in addition to sending */
  debug: boolean;
}

/**
 * Get default sample rate based on environment
 */
function getDefaultSampleRate(env: Environment): number {
  switch (env) {
    case "production":
      return 0.05; // 5% sampling in production
    case "staging":
      return 0.25; // 25% sampling in staging
    case "development":
      return 0; // Disabled by default in dev
    case "test":
      return 0; // Disabled in tests
    default:
      return 0;
  }
}

/**
 * Get current environment
 */
function getCurrentEnvironment(): Environment {
  if (typeof window === "undefined") return "production";

  const publicEnv = clientEnv.NEXT_PUBLIC_APP_ENV;

  // Check explicit environment variable first
  if (publicEnv === "staging") return "staging";
  if (publicEnv === "production") return "production";
  if (publicEnv === "development") return "development";

  return "production"; // Safe default
}

/**
 * Get Web Vitals configuration from environment and defaults
 */
export function getWebVitalsConfig(): WebVitalsConfig {
  const environment = getCurrentEnvironment();
  const defaultSampleRate = getDefaultSampleRate(environment);

  // Allow runtime override of enabled state
  const enabled =
    clientEnv.NEXT_PUBLIC_WEB_VITALS_ENABLED !== undefined
      ? clientEnv.NEXT_PUBLIC_WEB_VITALS_ENABLED
      : environment !== "development" && environment !== "test";

  // Allow runtime override of sample rate
  const sampleRate = clientEnv.NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE ?? defaultSampleRate;

  // Allow runtime override of endpoint
  const endpoint = clientEnv.NEXT_PUBLIC_WEB_VITALS_ENDPOINT ?? "/api/telemetry/web-vitals";

  // Debug mode
  const debug = clientEnv.NEXT_PUBLIC_WEB_VITALS_DEBUG ?? false;

  // Build info (can be injected at build time)
  const buildId = clientEnv.NEXT_PUBLIC_BUILD_ID;

  return {
    enabled,
    sampleRate: Math.max(0, Math.min(1, sampleRate)), // Clamp to 0-1
    endpoint,
    environment,
    appName: "atlas-web",
    buildId,
    debug,
  };
}

/**
 * Determine if current session should report vitals based on sample rate
 */
export function shouldReportVitals(sampleRate: number): boolean {
  if (sampleRate <= 0) return false;
  if (sampleRate >= 1) return true;

  // Use sessionStorage to ensure consistent sampling for the session
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") return false;

  try {
    const stored = sessionStorage.getItem("web-vitals-sampled");
    if (stored !== null) {
      return stored === "true";
    }

    const sampled = Math.random() < sampleRate;
    sessionStorage.setItem("web-vitals-sampled", String(sampled));
    return sampled;
  } catch {
    // sessionStorage not available, fall back to random
    return Math.random() < sampleRate;
  }
}
