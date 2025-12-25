/**
 * Runtime Configuration Module
 *
 * Provides client-side access to runtime environment configuration
 * without build-time inlining.
 *
 * This module enables "build once, deploy many" by loading configuration
 * at runtime rather than baking it into the client bundle at build time.
 *
 * @module runtime-config
 *
 * @example Provider setup
 * ```tsx
 * import { RuntimeConfigProvider } from '@/lib/runtime-config';
 *
 * export function MainProvider({ children }) {
 *   return (
 *     <RuntimeConfigProvider>
 *       {children}
 *     </RuntimeConfigProvider>
 *   );
 * }
 * ```
 *
 * @example Hook usage
 * ```tsx
 * import { useRuntimeConfig } from '@/lib/runtime-config';
 *
 * function MyComponent() {
 *   const { apiBaseUrl, environment } = useRuntimeConfig();
 *   return <div>Environment: {environment}</div>;
 * }
 * ```
 */

export { clearRuntimeConfigCache, loadRuntimeConfig } from "./client";
export type { RuntimeConfigProviderProps } from "./provider";
export { RuntimeConfigProvider, useRuntimeConfig } from "./provider";
export type { RuntimeConfig } from "./schema";
export { runtimeConfigSchema } from "./schema";
