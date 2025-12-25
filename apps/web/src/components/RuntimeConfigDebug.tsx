/**
 * Runtime Config Debug Component
 *
 * Displays runtime configuration values for debugging.
 * Only shown in development mode.
 *
 * @internal Development only
 */

"use client";

import { useRuntimeConfig } from "@/lib/runtime-config";

export function RuntimeConfigDebug() {
  const config = useRuntimeConfig();

  // Only show in development
  if (config.environment === "production") {
    return null;
  }

  return (
    <div className="border-border bg-card fixed right-4 bottom-4 max-w-md rounded-lg border p-4 text-xs shadow-lg">
      <div className="text-card-foreground mb-2 font-semibold">Runtime Config (Dev Only)</div>
      <div className="text-muted-foreground space-y-1 font-mono">
        <div>
          <span className="text-foreground">Environment:</span> {config.environment}
        </div>
        <div className="break-all">
          <span className="text-foreground">API URL:</span> {config.apiBaseUrl}
        </div>
        <div className="break-all">
          <span className="text-foreground">App URL:</span> {config.appUrl}
        </div>
        {config.buildId && (
          <div>
            <span className="text-foreground">Build:</span> {config.buildId}
          </div>
        )}
        {config.webVitals && (
          <div>
            <span className="text-foreground">Web Vitals:</span>{" "}
            {config.webVitals.enabled ? "enabled" : "disabled"}
          </div>
        )}
      </div>
    </div>
  );
}
