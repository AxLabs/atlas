/**
 * API Configuration
 *
 * Centralized configuration for API client behavior.
 * Uses the config facade to access base URLs and common settings.
 */

import { getServerConfig } from "@/config";

/**
 * Get the API base URL from configuration.
 *
 * This function provides server-side access to the API base URL.
 * For client-side usage, use the useConfig() hook instead.
 *
 * @example Server-side usage
 * ```tsx
 * import { getApiBaseUrl } from '@/lib/api/config';
 *
 * export async function GET() {
 *   const baseUrl = getApiBaseUrl();
 *   const response = await fetch(`${baseUrl}/users`);
 *   // ...
 * }
 * ```
 *
 * @example Client-side usage
 * ```tsx
 * import { useConfig } from '@/config';
 *
 * function MyComponent() {
 *   const config = useConfig();
 *   const baseUrl = config.api.baseUrl;
 *   // Use baseUrl...
 * }
 * ```
 */
export function getApiBaseUrl(): string {
  // Server-side only: uses config facade
  return getServerConfig().api.baseUrl;
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
