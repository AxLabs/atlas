/**
 * Client Configuration Module
 *
 * Provides client-safe configuration by converting runtime config into
 * the canonical config shape. This module runs in the browser and uses
 * the runtime config pattern to enable "build once, deploy many".
 *
 * This module must NOT import server-only modules or use serverEnv.
 *
 * @module config/client
 */

"use client";

import { useRuntimeConfig } from "@/lib/runtime-config";

import { clientConfigSchema } from "./schema";

import type { ClientConfig } from "./schema";
import type { RuntimeConfig } from "@/lib/runtime-config";

/**
 * Convert runtime config to canonical config shape.
 *
 * This adapter function transforms the runtime config loaded from
 * /api/runtime-config into the standard Config interface used throughout
 * the application.
 *
 * @param runtimeConfig - Runtime config from API endpoint
 * @returns Client-safe config object
 *
 * @internal
 */
export function createClientConfig(runtimeConfig: RuntimeConfig): ClientConfig {
  const config: ClientConfig = {
    app: {
      url: runtimeConfig.appUrl,
      env: runtimeConfig.environment,
      buildId: runtimeConfig.buildId,
    },

    api: {
      baseUrl: runtimeConfig.apiBaseUrl,
    },

    sentry: {
      enabled: Boolean(runtimeConfig.sentryDsn),
      dsn: runtimeConfig.sentryDsn,
      environment: runtimeConfig.sentryEnvironment,
      release: runtimeConfig.sentryRelease,
    },

    webVitals: {
      enabled: runtimeConfig.webVitals?.enabled ?? false,
      sampleRate: runtimeConfig.webVitals?.sampleRate ?? 0.05,
      endpoint: runtimeConfig.webVitals?.endpoint ?? "/api/telemetry/web-vitals",
      debug: runtimeConfig.webVitals?.debug ?? false,
    },

    features: runtimeConfig.featureFlags ?? {},
  };

  // Validate against client config schema
  return clientConfigSchema.parse(config);
}

/**
 * Hook to access client-side configuration.
 *
 * Must be used within a RuntimeConfigProvider (mounted in app root).
 * Returns the canonical config shape derived from runtime config.
 *
 * @returns Client-safe configuration object
 * @throws Error if used outside RuntimeConfigProvider
 *
 * @example
 * ```tsx
 * import { useConfig } from '@/config';
 *
 * function ApiClient() {
 *   const config = useConfig();
 *
 *   async function fetchData() {
 *     const response = await fetch(`${config.api.baseUrl}/data`);
 *     // ...
 *   }
 *
 *   return <button onClick={fetchData}>Load</button>;
 * }
 * ```
 *
 * @example Accessing nested config
 * ```tsx
 * import { useConfig } from '@/config';
 *
 * function EnvironmentBadge() {
 *   const config = useConfig();
 *
 *   return (
 *     <div className="badge">
 *       Environment: {config.app.env}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Feature flags
 * ```tsx
 * import { useConfig } from '@/config';
 *
 * function FeatureGate() {
 *   const config = useConfig();
 *
 *   if (!config.features.newDashboard) {
 *     return <LegacyDashboard />;
 *   }
 *
 *   return <NewDashboard />;
 * }
 * ```
 */
export function useConfig(): ClientConfig {
  const runtimeConfig = useRuntimeConfig();
  return createClientConfig(runtimeConfig);
}
