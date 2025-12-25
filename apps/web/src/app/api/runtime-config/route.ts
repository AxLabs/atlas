/**
 * Runtime Configuration API Endpoint
 *
 * Returns client-safe runtime configuration as JSON.
 * This endpoint is called once by the client at startup to load
 * environment-specific configuration without build-time inlining.
 *
 * This enables "build once, deploy many" by separating build-time
 * from runtime configuration.
 *
 * @route GET /api/runtime-config
 */

import { NextResponse } from "next/server";

import { clientEnv } from "@/env";
import { runtimeConfigSchema } from "@/lib/runtime-config/schema";

import type { RuntimeConfig } from "@/lib/runtime-config/schema";

/**
 * Force Node.js runtime (not Edge).
 * Runtime config may need access to filesystem or other Node.js APIs.
 */
export const runtime = "nodejs";

/**
 * Cache configuration for runtime config endpoint.
 *
 * Strategy: Short-lived cache to reduce load while allowing updates.
 * - s-maxage=60: Cache for 60 seconds in CDN/proxy
 * - stale-while-revalidate=30: Serve stale for 30s while revalidating
 *
 * This balances performance with the ability to update config without
 * waiting for long cache expirations.
 *
 * For stricter freshness, use: 'no-store, must-revalidate'
 */
const CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=30";

/**
 * GET /api/runtime-config
 *
 * Returns validated runtime configuration for client consumption.
 *
 * @returns JSON response with RuntimeConfig shape
 * @throws 500 if configuration is invalid or missing required values
 */
export async function GET(): Promise<NextResponse<RuntimeConfig>> {
  try {
    // Construct runtime config from server environment
    // Only include client-safe, runtime-varying values
    const config: RuntimeConfig = {
      apiBaseUrl: clientEnv.NEXT_PUBLIC_API_URL,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      environment: clientEnv.NEXT_PUBLIC_APP_ENV ?? "development",
      buildId: clientEnv.NEXT_PUBLIC_BUILD_ID,
      sentryDsn: clientEnv.NEXT_PUBLIC_SENTRY_DSN,
      sentryEnvironment: clientEnv.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
      sentryRelease: clientEnv.NEXT_PUBLIC_SENTRY_RELEASE,
      webVitals: {
        enabled: clientEnv.NEXT_PUBLIC_WEB_VITALS_ENABLED ?? false,
        sampleRate: clientEnv.NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE ?? 0.05,
        endpoint: clientEnv.NEXT_PUBLIC_WEB_VITALS_ENDPOINT ?? "/api/telemetry/web-vitals",
        debug: clientEnv.NEXT_PUBLIC_WEB_VITALS_DEBUG ?? false,
      },
      featureFlags: {
        // Add feature flags here as needed
        // Example: newDashboard: process.env.FEATURE_NEW_DASHBOARD === 'true'
      },
    };

    // Validate config against schema
    // This ensures we never return invalid or unsafe data to the client
    const validatedConfig = runtimeConfigSchema.parse(config);

    return NextResponse.json(validatedConfig, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": CACHE_CONTROL,
      },
    });
  } catch (error) {
    // Log error for debugging
    // eslint-disable-next-line no-console
    console.error("Failed to generate runtime config:", error);

    // Return error response
    // Don't expose internal error details to client
    return NextResponse.json(
      {
        error: "Failed to load runtime configuration",
        // Include correlation info for debugging
        timestamp: new Date().toISOString(),
      } as never,
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, must-revalidate",
        },
      }
    );
  }
}
