/// <reference types="vanilla-cookieconsent" />

declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

type AtlasCookieConsentConfig = CookieConsent.CookieConsentConfig;
type AtlasCookieConsentModule = typeof CookieConsent;
