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
};
