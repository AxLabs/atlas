/**
 * Server-only environment variables schema.
 *
 * Defines validation rules for sensitive server-side variables
 * that should never be exposed to the client.
 */

import { z } from "zod";

/**
 * Zod schema for validating server-only environment variables.
 *
 * These values are pulled from process.env and validated on app startup.
 * They are kept strictly on the server side and never exposed to the client.
 */
export const ServerEnvSchema = {
  /**
   * Node environment for server-side logic.
   * Determines application behavior and security settings.
   *
   * @default 'development'
   * @example 'production' | 'development' | 'test'
   */
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /**
   * Database connection URL.
   * Used to connect to your database (PostgreSQL, MySQL, etc.)
   *
   * @security Keep this secret secure - never expose to client
   * @example 'postgresql://user:password@localhost:5432/dbname'
   */
  DATABASE_URL: z.string().url(),
};
