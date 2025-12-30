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

interface MainProviderProps {
  children: React.ReactNode;
  nonce?: string;
}

export function MainProvider({ children, nonce }: MainProviderProps) {
  return (
    <RuntimeConfigProvider>
      <FeatureFlagsProvider>
        <EnvProvider>
          <ThemeProvider>
            <ReactQueryProvider>
              <ToasterProvider>
                <AnalyticsProvider nonce={nonce}>
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
