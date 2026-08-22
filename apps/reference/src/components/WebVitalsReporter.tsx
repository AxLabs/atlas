"use client";

/**
 * Web Vitals Reporter Component
 *
 * Client component that initializes Web Vitals reporting.
 * Dynamically loads web-vitals only when reporting is enabled.
 */

import { useEffect } from "react";

import { getClientConfig } from "@/config/client";

/**
 * WebVitalsReporter component
 *
 * Initializes Web Vitals collection on mount.
 * Runs only once per page load.
 */
export function WebVitalsReporter() {
  useEffect(() => {
    if (!getClientConfig().webVitals.enabled) return;

    void import("@/lib/telemetry/webVitals").then(({ initWebVitalsReporting }) => {
      initWebVitalsReporting();
    });
  }, []);

  return null;
}
