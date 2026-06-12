import type React from "react";

/**
 * Consent category identifiers used across Atlas apps.
 */
export const CONSENT_CATEGORIES = {
  necessary: "necessary",
  analytics: "analytics",
  marketing: "marketing",
  preferences: "preferences",
} as const;

export type ConsentCategory = (typeof CONSENT_CATEGORIES)[keyof typeof CONSENT_CATEGORIES];

/**
 * Service identifiers grouped by consent category.
 */
export const CONSENT_SERVICES = {
  analytics: {
    googleAnalytics: "google-analytics",
    postHog: "posthog",
  },
  marketing: {
    googleAds: "google-ads",
    metaPixel: "meta-pixel",
  },
  preferences: {
    theme: "theme",
    language: "language",
  },
} as const;

export type AnalyticsService =
  (typeof CONSENT_SERVICES.analytics)[keyof typeof CONSENT_SERVICES.analytics];
export type MarketingService =
  (typeof CONSENT_SERVICES.marketing)[keyof typeof CONSENT_SERVICES.marketing];
export type PreferencesService =
  (typeof CONSENT_SERVICES.preferences)[keyof typeof CONSENT_SERVICES.preferences];

export type ConsentService = AnalyticsService | MarketingService | PreferencesService;

export type AtlasConsentMode = "disabled" | "opt-in" | "opt-out";

/**
 * App-level consent configuration. Stable, boring, and intentionally small.
 */
export interface AtlasConsentConfig {
  enabled: boolean;
  mode?: "opt-in" | "opt-out";
  revision?: number;
  appName: string;
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;
  contactUrl?: string;
  categories?: {
    analytics?: {
      enabled?: boolean;
      services?: {
        googleAnalytics?: boolean;
        postHog?: boolean;
      };
    };
    marketing?: {
      enabled?: boolean;
      services?: {
        googleAds?: boolean;
        metaPixel?: boolean;
      };
    };
    preferences?: {
      enabled?: boolean;
      services?: {
        theme?: boolean;
        language?: boolean;
      };
    };
  };
}

/**
 * Resolved consent state exposed to consuming apps.
 */
export interface ConsentStatus {
  isEnabled: boolean;
  hasResolvedConsent: boolean;
  analyticsGranted: boolean;
  marketingGranted: boolean;
  preferencesGranted: boolean;
}

export interface ConsentContextValue extends ConsentStatus {
  openPreferences: () => void;
  acceptAll: () => void;
  rejectAll: () => void;
  resetConsent: () => void;
}

export interface ConsentProviderProps {
  config: AtlasConsentConfig;
  children: React.ReactNode;
  onAnalyticsConsentChange?: (granted: boolean) => void;
  debug?: boolean;
}
