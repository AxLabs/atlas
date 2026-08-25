/**
 * Safe platform runtime summary for reference diagnostics.
 *
 * Explicitly picks public fields — never serializes full server config.
 */

import { getServerConfig } from "@/config/server";
import { getSecurityHeaders } from "@/lib/security/headers";

export interface SafePlatformRuntime {
  application: string;
  environment: string;
  appUrl: string;
  apiMode: "same-origin" | "external";
  buildId: string | null;
  referenceMode: boolean;
  sentry: {
    configured: boolean;
    environment: string | null;
    release: string | null;
  };
  webVitals: {
    enabled: boolean;
    sampleRate: number;
    endpoint: string;
    debug: boolean;
  };
  analytics: {
    posthogConfigured: boolean;
    gaConfigured: boolean;
    debug: boolean;
  };
  consent: {
    enabled: boolean;
    mode: string;
    revision: number;
  };
  authIntegration: {
    googleOAuthConfigured: boolean;
    referenceAuthAvailable: boolean;
  };
  features: {
    example_feature: boolean;
    kill_example_feature: boolean;
  };
}

export interface SafeSecuritySummary {
  cspMode: "off" | "report-only" | "enforce";
  hstsEnabled: boolean;
  frameAncestors: string;
  xFrameOptions: string;
  baselineHeaderCount: number;
}

/**
 * Build a client-safe runtime summary from validated config.
 */
export function getSafePlatformRuntime(): SafePlatformRuntime {
  const config = getServerConfig();
  const apiBaseUrl = config.api.baseUrl;
  const isSameOrigin = apiBaseUrl.startsWith("/");

  return {
    application: "@atlas/reference",
    environment: config.app.env,
    appUrl: config.app.url,
    apiMode: isSameOrigin ? "same-origin" : "external",
    buildId: config.app.buildId ?? null,
    referenceMode: config.reference.enabled,
    sentry: {
      configured: config.sentry.enabled,
      environment: config.sentry.environment ?? config.app.env,
      release: config.sentry.release ?? config.app.buildId ?? null,
    },
    webVitals: {
      enabled: config.webVitals.enabled,
      sampleRate: config.webVitals.sampleRate,
      endpoint: config.webVitals.endpoint,
      debug: config.webVitals.debug,
    },
    analytics: {
      posthogConfigured: Boolean(config.analytics.posthogKey),
      gaConfigured: Boolean(config.analytics.gaMeasurementId),
      debug: config.analytics.debug,
    },
    consent: {
      enabled: config.consent.enabled,
      mode: config.consent.mode,
      revision: config.consent.revision,
    },
    authIntegration: {
      googleOAuthConfigured:
        Boolean(config.auth.googleClientId) && Boolean(config.auth.googleClientSecret),
      referenceAuthAvailable: config.reference.enabled,
    },
    features: {
      example_feature: config.features.example_feature ?? false,
      kill_example_feature: config.features.kill_example_feature ?? false,
    },
  };
}

/**
 * Interpreted security configuration without exposing secrets.
 */
export function getSafeSecuritySummary(): SafeSecuritySummary {
  const config = getServerConfig();
  const baseline = getSecurityHeaders({ enableHSTS: config.security.hstsEnabled });

  return {
    cspMode: config.security.cspMode,
    hstsEnabled: config.security.hstsEnabled,
    frameAncestors: config.security.frameAncestors,
    xFrameOptions: baseline["X-Frame-Options"] ?? "not set",
    baselineHeaderCount: Object.keys(baseline).length,
  };
}

/**
 * Keys that must never appear in platform diagnostics payloads.
 */
export const FORBIDDEN_PLATFORM_KEYS = [
  "AUTH_SESSION_SECRET",
  "GOOGLE_CLIENT_SECRET",
  "SENTRY_AUTH_TOKEN",
  "DATABASE_URL",
  "sessionSecret",
  "googleClientSecret",
  "dsn",
] as const;
