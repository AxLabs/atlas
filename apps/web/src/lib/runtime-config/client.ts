/**
 * Runtime Configuration Client Loader
 *
 * Provides client-side loading and caching of runtime configuration.
 * Fetches config from /api/runtime-config once and memoizes the result
 * for the lifetime of the client session.
 *
 * @module runtime-config/client
 */

import { runtimeConfigSchema } from "./schema";

import type { RuntimeConfig } from "./schema";

/**
 * In-memory cache for runtime config.
 * Stores the promise to prevent duplicate requests during initial load.
 */
let configPromise: Promise<RuntimeConfig> | null = null;

/**
 * Cached runtime config result.
 * Set after the first successful load.
 */
let cachedConfig: RuntimeConfig | null = null;

/**
 * Load runtime configuration from the server.
 *
 * This function:
 * 1. Fetches /api/runtime-config endpoint
 * 2. Validates the response with the schema
 * 3. Caches the result in memory
 * 4. Returns the same promise for concurrent calls (deduplication)
 *
 * The config is loaded once per client session and cached in memory.
 * Subsequent calls return the cached result immediately.
 *
 * @returns Promise resolving to validated RuntimeConfig
 * @throws Error if fetch fails or response is invalid
 *
 * @example
 * ```typescript
 * import { loadRuntimeConfig } from '@/lib/runtime-config/client';
 *
 * const config = await loadRuntimeConfig();
 * console.log(config.apiBaseUrl);
 * ```
 */
export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  // Return cached config if already loaded
  if (cachedConfig) {
    return cachedConfig;
  }

  // Return existing promise if already loading (deduplication)
  if (configPromise) {
    return configPromise;
  }

  // Start loading config
  configPromise = (async () => {
    try {
      // Fetch runtime config from API endpoint
      // Use no-store to ensure we get fresh config on each page load/refresh
      // The endpoint itself handles caching via Cache-Control headers
      const response = await fetch("/api/runtime-config", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to load runtime config: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Validate response against schema
      // This ensures type safety and catches malformed responses early
      const config = runtimeConfigSchema.parse(data);

      // Cache the validated config
      cachedConfig = config;

      return config;
    } catch (error) {
      // Clear the promise on error so next call can retry
      configPromise = null;

      // Re-throw with context
      if (error instanceof Error) {
        throw new Error(`Runtime config load failed: ${error.message}`, {
          cause: error,
        });
      }

      throw new Error("Runtime config load failed: Unknown error");
    }
  })();

  return configPromise;
}

/**
 * Clear the runtime config cache.
 *
 * Useful for testing or when you need to force a reload.
 * In production, this should rarely be needed as config is loaded once at startup.
 *
 * @internal
 */
export function clearRuntimeConfigCache(): void {
  cachedConfig = null;
  configPromise = null;
}
