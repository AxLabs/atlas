/**
 * Config Module - Single Source of Truth for Configuration
 *
 * Provides a unified, typed configuration facade for Atlas application.
 * Abstracts away the complexity of environment variables and runtime config
 * into a clean, stable API.
 *
 * ## Architecture
 *
 * - **Server**: Config built from env vars (via @t3-oss/env-nextjs)
 * - **Client**: Config built from runtime config (loaded at startup)
 * - **Schema**: Single typed contract enforced on both sides
 *
 * ## Usage
 *
 * ### Server-side (API routes, server components, middleware)
 * ```tsx
 * import { getServerConfig } from '@/config';
 *
 * export async function GET() {
 *   const config = getServerConfig();
 *   const apiUrl = config.api.baseUrl;
 *   // ...
 * }
 * ```
 *
 * ### Client-side (client components, hooks)
 * ```tsx
 * import { useConfig } from '@/config';
 *
 * function MyComponent() {
 *   const config = useConfig();
 *   const apiUrl = config.api.baseUrl;
 *   // ...
 * }
 * ```
 *
 * ## Rules
 *
 * 1. **Never read process.env directly** - use config module only
 * 2. **Server code uses getServerConfig()** - has access to all config
 * 3. **Client code uses useConfig()** - has access to client-safe config only
 * 4. **Add new config via schema** - ensures type safety and validation
 *
 * @module config
 * @see {@link file://../../docs/CONFIG.md} for detailed documentation
 */

// ============================================================================
// Server Exports (use in server components, API routes, middleware)
// ============================================================================

export { getServerConfig, serverConfig } from "./server";

// ============================================================================
// Client Exports (use in client components, hooks)
// ============================================================================

export { createClientConfig, useConfig } from "./client";

// ============================================================================
// Type Exports (use for type annotations)
// ============================================================================

export type { ClientConfig, Config } from "./schema";
export { clientConfigSchema, configSchema } from "./schema";
