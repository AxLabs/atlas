import { CONSENT_CATEGORIES, CONSENT_SERVICES } from "./types";

import type { AtlasCookieConsentModule } from "./cookieconsent-types";
import type { ConsentCategory, ConsentService } from "./types";

let cookieConsentModule: AtlasCookieConsentModule | null = null;

/**
 * Store the dynamically loaded CookieConsent module for utility access.
 * @internal
 */
export function setCookieConsentModule(module: AtlasCookieConsentModule | null): void {
  cookieConsentModule = module;
}

function getCookieConsent(): AtlasCookieConsentModule | null {
  if (typeof window === "undefined") {
    return null;
  }

  return cookieConsentModule;
}

/**
 * Returns whether a consent category has been accepted.
 * Safe default: false when CookieConsent is unavailable.
 */
export function hasConsentForCategory(category: ConsentCategory): boolean {
  const cc = getCookieConsent();
  if (!cc) {
    return false;
  }

  try {
    return cc.acceptedCategory(category);
  } catch {
    return false;
  }
}

/**
 * Returns whether a specific service within a category has been accepted.
 * Safe default: false when CookieConsent is unavailable.
 */
export function hasConsentForService(service: ConsentService, category: ConsentCategory): boolean {
  const cc = getCookieConsent();
  if (!cc) {
    return false;
  }

  try {
    return cc.acceptedService(service, category);
  } catch {
    return false;
  }
}

/**
 * Run an action against the initialized CookieConsent module when available.
 * @internal
 */
export function withCookieConsent(action: (cc: AtlasCookieConsentModule) => void): void {
  const cc = getCookieConsent();
  if (!cc) {
    return;
  }

  action(cc);
}

/**
 * Opens the CookieConsent preferences modal.
 * No-op when CookieConsent is unavailable.
 */
export function openConsentPreferences(): void {
  withCookieConsent((cc) => {
    try {
      cc.showPreferences();
    } catch {
      // Swallow — caller may be in SSR or pre-init
    }
  });
}

/**
 * Runs a callback when consent for a category is granted.
 * Executes immediately if consent is already granted.
 */
export function runWhenConsentGranted(category: ConsentCategory, callback: () => void): void {
  if (hasConsentForCategory(category)) {
    callback();
    return;
  }

  if (typeof window === "undefined") {
    return;
  }

  const handler = () => {
    if (hasConsentForCategory(category)) {
      callback();
      window.removeEventListener("cc:onConsent", handler);
      window.removeEventListener("cc:onChange", handler);
    }
  };

  window.addEventListener("cc:onConsent", handler);
  window.addEventListener("cc:onChange", handler);
}

/**
 * Read analytics consent from CookieConsent if available.
 */
export function readAnalyticsConsent(): boolean {
  return hasConsentForCategory(CONSENT_CATEGORIES.analytics);
}

/**
 * Read marketing consent from CookieConsent if available.
 */
export function readMarketingConsent(): boolean {
  return hasConsentForCategory(CONSENT_CATEGORIES.marketing);
}

/**
 * Read preferences consent from CookieConsent if available.
 */
export function readPreferencesConsent(): boolean {
  return hasConsentForCategory(CONSENT_CATEGORIES.preferences);
}

/**
 * Dispatch a custom event so runWhenConsentGranted listeners can react.
 * @internal
 */
export function dispatchConsentChangeEvent(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event("cc:onChange"));
}

export { CONSENT_CATEGORIES, CONSENT_SERVICES };
