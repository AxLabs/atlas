"use client";

/**
 * Web Vitals Reporter Component
 *
 * Client component that initializes Web Vitals reporting.
 * Dynamically loads web-vitals only when reporting is enabled.
 */

import { useEffect } from "react";

const WEB_VITALS_ENABLED = process.env.NEXT_PUBLIC_WEB_VITALS_ENABLED === "true";

/**
 * WebVitalsReporter component
 *
 * Initializes Web Vitals collection on mount.
 * Runs only once per page load.
 */
export function WebVitalsReporter() {
  useEffect(() => {
    if (!WEB_VITALS_ENABLED) return;

    void import("@/lib/telemetry/webVitals").then(({ initWebVitalsReporting }) => {
      initWebVitalsReporting();
    });
  }, []);

  return null;
}
