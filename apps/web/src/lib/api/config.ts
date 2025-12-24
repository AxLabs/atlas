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
 * In development, defaults to localhost if not configured.
 * In production, must be explicitly set.
 */
export function getApiBaseUrl(): string {
  // Check for public env var (available client-side)
  if (typeof window !== "undefined") {
    // Client-side: use NEXT_PUBLIC_ prefix
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
