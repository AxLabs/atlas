"use client";

import { WebVitalsReporter } from "@/components/WebVitalsReporter";
import { FeatureFlagsProvider } from "@/lib/feature-flags";

import { AnalyticsProvider } from "./analytics-provider";
import { ThemeProvider } from "./theme-provider";
import { ToasterProvider } from "./toaster-provider";

import type React from "react";

interface MainProviderProps {
  children: React.ReactNode;
  nonce?: string;
}

export function MainProvider({ children, nonce }: MainProviderProps) {
  return (
    <FeatureFlagsProvider>
      <ThemeProvider>
        <ToasterProvider>
          <AnalyticsProvider nonce={nonce}>
            <WebVitalsReporter />
            {children}
          </AnalyticsProvider>
        </ToasterProvider>
      </ThemeProvider>
    </FeatureFlagsProvider>
  );
}
