"use client";

import type React from "react";

import { EnvProvider } from "./env-provider";
import { ReactQueryProvider } from "./react-query-provider";
import { ThemeProvider } from "./theme-provider";
import { ToasterProvider } from "./toaster-provider";

import { WebVitalsReporter } from "@/components/WebVitalsReporter";

export function MainProvider({ children }: { children: React.ReactNode }) {
  return (
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
  );
}
