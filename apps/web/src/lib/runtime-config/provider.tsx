/**
 * Runtime Configuration Provider
 *
 * Loads and provides runtime configuration to the entire React tree.
 * Config is loaded once at startup and made available via React Context.
 *
 * This provider should be mounted high in the component tree, typically
 * in the root layout or main provider composition.
 *
 * @module runtime-config/provider
 */

"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { loadRuntimeConfig } from "./client";

import type { RuntimeConfig } from "./schema";
import type React from "react";

/**
 * React Context for runtime configuration.
 * Provides typed access to runtime config throughout the component tree.
 */
const RuntimeConfigContext = createContext<RuntimeConfig | undefined>(undefined);

/**
 * Loading states for the provider.
 */
type LoadingState =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "success"; config: RuntimeConfig };

/**
 * Props for RuntimeConfigProvider.
 */
export interface RuntimeConfigProviderProps {
  /**
   * Child components that will have access to runtime config.
   */
  children: React.ReactNode;

  /**
   * Optional loading fallback.
   * Displayed while runtime config is being fetched.
   *
   * @default Minimal accessible loading message
   */
  loadingFallback?: React.ReactNode;

  /**
   * Optional error fallback.
   * Displayed if runtime config fails to load.
   *
   * @default Minimal accessible error message
   */
  errorFallback?: React.ReactNode;
}

/**
 * Default loading fallback.
 * Simple, accessible loading indicator.
 */
function DefaultLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading application configuration"
      className="flex min-h-screen items-center justify-center"
    >
      <div className="text-center">
        <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" />
        <p className="text-muted-foreground text-sm">Loading configuration...</p>
      </div>
    </div>
  );
}

/**
 * Default error fallback.
 * Simple, accessible error message with retry suggestion.
 */
function DefaultErrorFallback({ error }: { error: Error }) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex min-h-screen items-center justify-center"
    >
      <div className="border-destructive/50 bg-destructive/10 max-w-md rounded-lg border p-6 text-center">
        <h1 className="text-destructive mb-2 text-lg font-semibold">Configuration Error</h1>
        <p className="text-muted-foreground mb-4 text-sm">
          Failed to load application configuration. Please refresh the page to try again.
        </p>
        <details className="text-left">
          <summary className="text-muted-foreground cursor-pointer text-xs">Error details</summary>
          <pre className="bg-muted mt-2 overflow-auto rounded p-2 text-xs">{error.message}</pre>
        </details>
      </div>
    </div>
  );
}

/**
 * Runtime Configuration Provider.
 *
 * Loads runtime config from /api/runtime-config on mount and provides it
 * to all child components via React Context.
 *
 * Usage:
 * 1. Mount high in your component tree (e.g., in MainProvider)
 * 2. Access config in any child component via useRuntimeConfig()
 *
 * @example
 * ```tsx
 * // In providers/index.tsx
 * import { RuntimeConfigProvider } from '@/lib/runtime-config/provider';
 *
 * export function MainProvider({ children }) {
 *   return (
 *     <RuntimeConfigProvider>
 *       <OtherProviders>
 *         {children}
 *       </OtherProviders>
 *     </RuntimeConfigProvider>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // In any component
 * import { useRuntimeConfig } from '@/lib/runtime-config/provider';
 *
 * function MyComponent() {
 *   const config = useRuntimeConfig();
 *   return <div>API: {config.apiBaseUrl}</div>;
 * }
 * ```
 */
export function RuntimeConfigProvider({
  children,
  loadingFallback,
  errorFallback,
}: RuntimeConfigProviderProps) {
  const [state, setState] = useState<LoadingState>({ status: "loading" });

  useEffect(() => {
    let mounted = true;

    loadRuntimeConfig()
      .then((config) => {
        if (mounted) {
          setState({ status: "success", config });
        }
      })
      .catch((error) => {
        if (mounted) {
          setState({
            status: "error",
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Loading state
  if (state.status === "loading") {
    return loadingFallback ?? <DefaultLoadingFallback />;
  }

  // Error state
  if (state.status === "error") {
    return errorFallback ?? <DefaultErrorFallback error={state.error} />;
  }

  // Success - provide config to children
  return (
    <RuntimeConfigContext.Provider value={state.config}>{children}</RuntimeConfigContext.Provider>
  );
}

/**
 * Hook to access runtime configuration.
 *
 * Must be used within a RuntimeConfigProvider.
 * Provides typed access to all runtime config values.
 *
 * @returns RuntimeConfig object
 * @throws Error if used outside RuntimeConfigProvider
 *
 * @example
 * ```tsx
 * import { useRuntimeConfig } from '@/lib/runtime-config/provider';
 *
 * function ApiClient() {
 *   const { apiBaseUrl } = useRuntimeConfig();
 *
 *   async function fetchData() {
 *     const response = await fetch(`${apiBaseUrl}/data`);
 *     // ...
 *   }
 *
 *   return <button onClick={fetchData}>Load</button>;
 * }
 * ```
 */
export function useRuntimeConfig(): RuntimeConfig {
  const config = useContext(RuntimeConfigContext);

  if (config === undefined) {
    throw new Error(
      "useRuntimeConfig must be used within a RuntimeConfigProvider. " +
        "Make sure RuntimeConfigProvider is mounted in your component tree."
    );
  }

  return config;
}
