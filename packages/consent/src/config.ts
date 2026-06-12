import { CONSENT_CATEGORIES, CONSENT_SERVICES } from "./types";

import type { AtlasCookieConsentConfig } from "./cookieconsent-types";
import type { AtlasConsentConfig } from "./types";

/**
 * Build a CookieConsent v3 configuration from Atlas app config.
 */
export function createAtlasCookieConsentConfig(
  config: AtlasConsentConfig
): AtlasCookieConsentConfig {
  const mode = config.mode ?? "opt-in";
  const revision = config.revision ?? 1;

  const analyticsEnabled = config.categories?.analytics?.enabled ?? false;
  const marketingEnabled = config.categories?.marketing?.enabled ?? false;
  const preferencesEnabled = config.categories?.preferences?.enabled ?? false;

  const analyticsServices: Record<string, { label: string }> = {};
  if (config.categories?.analytics?.services?.googleAnalytics) {
    analyticsServices[CONSENT_SERVICES.analytics.googleAnalytics] = {
      label: "Google Analytics",
    };
  }
  if (config.categories?.analytics?.services?.postHog) {
    analyticsServices[CONSENT_SERVICES.analytics.postHog] = {
      label: "PostHog",
    };
  }

  const marketingServices: Record<string, { label: string }> = {};
  if (config.categories?.marketing?.services?.googleAds) {
    marketingServices[CONSENT_SERVICES.marketing.googleAds] = {
      label: "Google Ads",
    };
  }
  if (config.categories?.marketing?.services?.metaPixel) {
    marketingServices[CONSENT_SERVICES.marketing.metaPixel] = {
      label: "Meta Pixel",
    };
  }

  const preferencesServices: Record<string, { label: string }> = {};
  if (config.categories?.preferences?.services?.theme ?? preferencesEnabled) {
    preferencesServices[CONSENT_SERVICES.preferences.theme] = {
      label: "Theme preference",
    };
  }
  if (config.categories?.preferences?.services?.language ?? preferencesEnabled) {
    preferencesServices[CONSENT_SERVICES.preferences.language] = {
      label: "Language preference",
    };
  }

  const categories: AtlasCookieConsentConfig["categories"] = {
    [CONSENT_CATEGORIES.necessary]: {
      enabled: true,
      readOnly: true,
    },
  };

  if (analyticsEnabled) {
    categories[CONSENT_CATEGORIES.analytics] = {
      enabled: mode === "opt-out",
      services: analyticsServices,
    };
  }

  if (marketingEnabled) {
    categories[CONSENT_CATEGORIES.marketing] = {
      enabled: false,
      services: marketingServices,
    };
  }

  if (preferencesEnabled) {
    categories[CONSENT_CATEGORIES.preferences] = {
      enabled: mode === "opt-out",
      services: preferencesServices,
    };
  }

  const privacyUrl = config.privacyPolicyUrl;
  const cookieUrl = config.cookiePolicyUrl;
  const contactUrl = config.contactUrl;

  return {
    mode,
    revision,
    autoShow: true,
    manageScriptTags: true,
    autoClearCookies: true,
    hideFromBots: true,
    categories,
    guiOptions: {
      consentModal: {
        layout: "box",
        position: "bottom right",
        equalWeightButtons: true,
        flipButtons: false,
      },
      preferencesModal: {
        layout: "box",
        position: "right",
        equalWeightButtons: true,
        flipButtons: false,
      },
    },
    language: {
      default: "en",
      translations: {
        en: {
          consentModal: {
            title: `${config.appName} uses cookies`,
            description:
              "We use cookies to improve your experience, analyze traffic, and remember your preferences. You can choose which categories to allow.",
            acceptAllBtn: "Accept all",
            acceptNecessaryBtn: "Reject all",
            showPreferencesBtn: "Manage preferences",
            footer: buildFooterLinks(privacyUrl, cookieUrl, contactUrl),
          },
          preferencesModal: {
            title: "Cookie preferences",
            acceptAllBtn: "Accept all",
            acceptNecessaryBtn: "Reject all",
            savePreferencesBtn: "Save preferences",
            closeIconLabel: "Close",
            sections: buildPreferenceSections(
              config.appName,
              analyticsEnabled,
              marketingEnabled,
              preferencesEnabled
            ),
          },
        },
      },
    },
  };
}

function buildFooterLinks(privacyUrl?: string, cookieUrl?: string, contactUrl?: string): string {
  const links: string[] = [];

  if (privacyUrl) {
    links.push(`<a href="${privacyUrl}">Privacy policy</a>`);
  }
  if (cookieUrl) {
    links.push(`<a href="${cookieUrl}">Cookie policy</a>`);
  }
  if (contactUrl) {
    links.push(`<a href="${contactUrl}">Contact</a>`);
  }

  return links.join("\n");
}

function buildPreferenceSections(
  appName: string,
  analyticsEnabled: boolean,
  marketingEnabled: boolean,
  preferencesEnabled: boolean
): { title: string; description: string; linkedCategory?: string }[] {
  const sections: { title: string; description: string; linkedCategory?: string }[] = [
    {
      title: "Cookie usage",
      description: `${appName} uses cookies to provide core functionality and optional features.`,
    },
    {
      title: "Strictly necessary",
      description: "Required for the site to function. These cannot be disabled.",
      linkedCategory: CONSENT_CATEGORIES.necessary,
    },
  ];

  if (analyticsEnabled) {
    sections.push({
      title: "Analytics",
      description: "Help us understand how visitors use the site so we can improve it.",
      linkedCategory: CONSENT_CATEGORIES.analytics,
    });
  }

  if (marketingEnabled) {
    sections.push({
      title: "Marketing",
      description: "Used to deliver relevant ads and measure campaign performance.",
      linkedCategory: CONSENT_CATEGORIES.marketing,
    });
  }

  if (preferencesEnabled) {
    sections.push({
      title: "Preferences",
      description: "Remember your settings such as theme and language.",
      linkedCategory: CONSENT_CATEGORIES.preferences,
    });
  }

  return sections;
}
