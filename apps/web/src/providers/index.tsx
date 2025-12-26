"use client";

import { WebVitalsReporter } from "@/components/WebVitalsReporter";
import { FeatureFlagsProvider } from "@/lib/feature-flags";
import { RuntimeConfigProvider } from "@/lib/runtime-config";

import { AnalyticsProvider } from "./analytics-provider";
import { EnvProvider } from "./env-provider";
import { ReactQueryProvider } from "./react-query-provider";
import { ThemeProvider } from "./theme-provider";
import { ToasterProvider } from "./toaster-provider";

import type React from "react";

export function MainProvider({ children }: { children: React.ReactNode }) {
  return (
    <RuntimeConfigProvider>
      <FeatureFlagsProvider>
        <EnvProvider>
          <ThemeProvider>
            <ReactQueryProvider>
              <ToasterProvider>
                <AnalyticsProvider>
                  <WebVitalsReporter />
                  {children}
                </AnalyticsProvider>
              </ToasterProvider>
            </ReactQueryProvider>
          </ThemeProvider>
        </EnvProvider>
      </FeatureFlagsProvider>
    </RuntimeConfigProvider>
  );
}
