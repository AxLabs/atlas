import {
  hasConsentForCategory,
  hasConsentForService,
  openConsentPreferences,
  setCookieConsentModule,
} from "../utils";
import { CONSENT_CATEGORIES, CONSENT_SERVICES } from "../types";

describe("consent utils", () => {
  afterEach(() => {
    setCookieConsentModule(null);
  });

  it("returns safe defaults when CookieConsent is unavailable", () => {
    expect(hasConsentForCategory(CONSENT_CATEGORIES.analytics)).toBe(false);
    expect(
      hasConsentForService(CONSENT_SERVICES.analytics.postHog, CONSENT_CATEGORIES.analytics)
    ).toBe(false);
    expect(() => openConsentPreferences()).not.toThrow();
  });

  it("reads category and service consent from CookieConsent", () => {
    const mockModule = {
      acceptedCategory: jest.fn((category: string) => category === CONSENT_CATEGORIES.analytics),
      acceptedService: jest.fn(
        (service: string, category: string) =>
          service === CONSENT_SERVICES.analytics.postHog &&
          category === CONSENT_CATEGORIES.analytics
      ),
      showPreferences: jest.fn(),
    };

    setCookieConsentModule(mockModule as never);

    expect(hasConsentForCategory(CONSENT_CATEGORIES.analytics)).toBe(true);
    expect(hasConsentForCategory(CONSENT_CATEGORIES.marketing)).toBe(false);
    expect(
      hasConsentForService(CONSENT_SERVICES.analytics.postHog, CONSENT_CATEGORIES.analytics)
    ).toBe(true);
    openConsentPreferences();
    expect(mockModule.showPreferences).toHaveBeenCalled();
  });

  it("returns false when CookieConsent throws", () => {
    setCookieConsentModule({
      acceptedCategory: () => {
        throw new Error("boom");
      },
      acceptedService: () => {
        throw new Error("boom");
      },
      showPreferences: () => {
        throw new Error("boom");
      },
    } as never);

    expect(hasConsentForCategory(CONSENT_CATEGORIES.analytics)).toBe(false);
    expect(() => openConsentPreferences()).not.toThrow();
  });
});
