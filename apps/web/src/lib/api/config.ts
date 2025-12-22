/**
 * API Configuration
 *
 * Centralized configuration for API client behavior.
 * Resolves base URLs from environment variables and provides
 * common settings used across all API calls.
 */

/**
 * Get the API base URL from environment.
 * In development, defaults to localhost if not configured.
 * In production, must be explicitly set.
 */
export function getApiBaseUrl(): string {
  // Check for public env var (available client-side)
  if (typeof window !== "undefined") {
    // Client-side: use NEXT_PUBLIC_ prefix
    return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";
  }

  // Server-side: can use either public or private env var
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? "http://localhost:3001/api"
  );
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
