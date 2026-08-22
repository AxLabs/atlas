/**
 * Analytics Provider
 *
 * Initializes and configures analytics adapters based on environment variables.
 * Handles the wiring of PostHog, GA, and any future analytics providers.
 *
 * @module providers/analytics-provider
 */

"use client";

import { useEffect, useRef, useState } from "react";

import { analytics, initAnalytics } from "@/lib/analytics";

import type { Analytics, CommonEventProps } from "@/lib/analytics";
import type React from "react";

/**
 * Analytics configuration from environment.
 */
interface AnalyticsConfig {
  posthog?: {
    apiKey: string;
    host?: string;
  };
  ga?: {
    measurementId: string;
  };
  debug: boolean;
  environment: CommonEventProps["env"];
}

function getAnalyticsConfig(): AnalyticsConfig {
  let environment: CommonEventProps["env"] = "development";

  const appEnv = process.env.NEXT_PUBLIC_APP_ENV;
  if (appEnv === "production" || appEnv === "staging" || appEnv === "development") {
    environment = appEnv;
  } else if (process.env.NODE_ENV === "production") {
    environment = "production";
  }

  const config: AnalyticsConfig = {
    debug: process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true",
    environment,
  };

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (posthogKey) {
    config.posthog = {
      apiKey: posthogKey,
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    };
  }

  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (gaMeasurementId) {
    config.ga = {
      measurementId: gaMeasurementId,
    };
  }

  return config;
}

interface AnalyticsProviderProps {
  children: React.ReactNode;
  consentGranted?: boolean;
  nonce?: string;
}

export function AnalyticsProvider({
  children,
  consentGranted = false,
  nonce,
}: AnalyticsProviderProps) {
  const initialized = useRef(false);
  const config = getAnalyticsConfig();
  const [gaScript, setGaScript] = useState<React.ReactNode>(null);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    let cancelled = false;
    const initialConsentGranted = consentGranted;

    async function initializeAnalytics() {
      const adapters: Analytics[] = [];

      if (config.posthog) {
        const { createPostHogAdapter } = await import("@/lib/analytics/adapters/posthog");
        if (cancelled) return;

        adapters.push(
          createPostHogAdapter({
            apiKey: config.posthog.apiKey,
            host: config.posthog.host,
            debug: config.debug,
            consentGranted: initialConsentGranted,
          })
        );

        if (config.debug) {
          // eslint-disable-next-line no-console
          console.debug("[analytics] PostHog adapter configured");
        }
      }

      if (config.ga) {
        const { createGAAdapter, GAScript } = await import("@/lib/analytics/adapters/ga");
        if (cancelled) return;

        adapters.push(
          createGAAdapter({
            measurementId: config.ga.measurementId,
            debug: config.debug,
            consentGranted: initialConsentGranted,
          })
        );

        setGaScript(
          <GAScript measurementId={config.ga.measurementId} debug={config.debug} nonce={nonce} />
        );

        if (config.debug) {
          // eslint-disable-next-line no-console
          console.debug("[analytics] GA adapter configured");
        }
      }

      if (cancelled) return;

      initAnalytics(adapters, {
        debug: config.debug,
        environment: config.environment,
        consentGranted: initialConsentGranted,
      });

      if (config.debug) {
        // eslint-disable-next-line no-console
        console.debug("[analytics] Initialized with", adapters.length, "adapter(s)");
      }
    }

    void initializeAnalytics();

    return () => {
      cancelled = true;
    };
    // consentGranted is intentionally excluded — init runs once; updates use analytics.setConsent
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see separate consentGranted effect below
  }, [config.debug, config.posthog, config.ga, config.environment, nonce]);

  useEffect(() => {
    analytics.setConsent(consentGranted);
  }, [consentGranted]);

  return (
    <>
      {gaScript}
      {children}
    </>
  );
}
