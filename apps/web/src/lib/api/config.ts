/**
 * API Configuration
 *
 * Centralized configuration for API client behavior.
 * Resolves base URLs from environment variables and provides
 * common settings used across all API calls.
 */

import { clientEnv, serverEnv } from "@/env";

/**
 * Get the API base URL from environment.
 *
 * IMPORTANT: This function uses build-time env vars and should ONLY be used:
 * 1. In server-side code (API routes, server components)
 * 2. In client code where runtime config is not available (legacy usage)
 *
 * For new client-side code, prefer using runtime config:
 * ```tsx
 * import { useRuntimeConfig } from '@/lib/runtime-config';
 *
 * function MyComponent() {
 *   const { apiBaseUrl } = useRuntimeConfig();
 *   // Use apiBaseUrl...
 * }
 * ```
 *
 * @deprecated For client-side usage, use runtime config instead
 */
export function getApiBaseUrl(): string {
  // Check for public env var (available client-side)
  if (typeof window !== "undefined") {
    // Client-side: use NEXT_PUBLIC_ prefix (build-time value)
    // This is a fallback for backwards compatibility
    return clientEnv.NEXT_PUBLIC_API_URL;
  }

  // Server-side: can use either public or private env var
  return serverEnv.API_BASE_URL ?? clientEnv.NEXT_PUBLIC_API_URL;
}

/**
 * Default API request timeout in milliseconds.
 */
export const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Default retry configuration for network errors and specific status codes.
 */
export const RETRY_CONFIG = {
  /**
   * Maximum number of retry attempts for retryable errors.
   */
  maxAttempts: 3,

  /**
   * HTTP status codes that should trigger a retry.
   * - 408: Request Timeout
   * - 429: Too Many Requests (with backoff)
   * - 502: Bad Gateway
   * - 503: Service Unavailable
   * - 504: Gateway Timeout
   */
  retryableStatuses: [408, 429, 502, 503, 504],

  /**
   * Base delay for exponential backoff in milliseconds.
   */
  baseDelayMs: 1000,

  /**
   * Maximum delay between retries in milliseconds.
   */
  maxDelayMs: 10000,
} as const;
