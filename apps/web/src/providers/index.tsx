"use client";

import { WebVitalsReporter } from "@/components/WebVitalsReporter";
import { RuntimeConfigProvider } from "@/lib/runtime-config";

import { EnvProvider } from "./env-provider";
import { ReactQueryProvider } from "./react-query-provider";
import { ThemeProvider } from "./theme-provider";
import { ToasterProvider } from "./toaster-provider";

import type React from "react";

export function MainProvider({ children }: { children: React.ReactNode }) {
  return (
    <RuntimeConfigProvider>
      <EnvProvider>
        <ThemeProvider>
          <ReactQueryProvider>
            <ToasterProvider>
              <WebVitalsReporter />
              {children}
            </ToasterProvider>
          </ReactQueryProvider>
        </ThemeProvider>
      </EnvProvider>
    </RuntimeConfigProvider>
  );
}
