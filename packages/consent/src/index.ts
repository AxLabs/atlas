export { createAtlasCookieConsentConfig } from "./config";
export { ConsentGate } from "./ConsentGate";
export { ConsentProvider, useConsent } from "./provider";
export type {
  AtlasConsentConfig,
  AtlasConsentMode,
  ConsentCategory,
  ConsentContextValue,
  ConsentProviderProps,
  ConsentService,
  ConsentStatus,
} from "./types";
export { CONSENT_CATEGORIES, CONSENT_SERVICES } from "./types";
export {
  hasConsentForCategory,
  hasConsentForService,
  openConsentPreferences,
  runWhenConsentGranted,
} from "./utils";
