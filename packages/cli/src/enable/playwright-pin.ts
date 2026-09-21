/**
 * Playwright specifiers that Atlas shipped on `apps/web` before aligning with
 * `@atlas/ui`. Enablement may replace these; any other value is a consumer
 * customization and must conflict.
 */
export const KNOWN_ATLAS_WEB_PLAYWRIGHT_SPECIFIERS = ["^1.61.0"] as const;

export const WEB_PLAYWRIGHT_PACKAGE_JSON = "apps/web/package.json";
export const PLAYWRIGHT_TEST_PACKAGE = "@playwright/test";
