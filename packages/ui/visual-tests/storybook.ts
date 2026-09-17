import { expect, type Locator, type Page } from "@playwright/test";

import { DARK_THEME_CLASS } from "../src/lib/theme";

export const STORYBOOK_ROOT = "#storybook-root";

export const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  mobile: { width: 390, height: 844 },
} as const;

export type ThemeName = "light" | "dark";

export function storyIframePath(storyId: string, theme: ThemeName = "light") {
  const params = new URLSearchParams({ id: storyId });
  if (theme === "dark") {
    params.set("globals", "theme:dark");
  }
  return `/iframe.html?${params.toString()}`;
}

/**
 * `@storybook/addon-themes` applies `html.dark` in a React useEffect after first
 * paint. Portaled overlays inherit CSS variables from `html`, so screenshots
 * taken before that effect runs capture light tokens even when `globals=theme:dark`.
 */
export async function waitForStoryTheme(page: Page, theme: ThemeName) {
  await page.waitForFunction(
    ({ expectedTheme, darkClass }) => {
      const isDark = document.documentElement.classList.contains(darkClass);
      return expectedTheme === "dark" ? isDark : !isDark;
    },
    { expectedTheme: theme, darkClass: DARK_THEME_CLASS },
    { timeout: 30_000 }
  );
}

export async function expectOverlayMatchesStoryTheme(locator: Locator, theme: ThemeName) {
  await expect
    .poll(
      async () =>
        locator.evaluate((element, expectedTheme) => {
          const rootIsDark = document.documentElement.classList.contains("dark");
          if (expectedTheme === "dark" && !rootIsDark) {
            return "html-missing-dark-class";
          }
          if (expectedTheme === "light" && rootIsDark) {
            return "html-has-unexpected-dark-class";
          }

          // Tooltip uses bg-foreground / text-background. Compare against tokens on
          // `html` so a dark-theme request cannot snapshot light :root variables.
          const probe = document.createElement("span");
          probe.style.backgroundColor = "var(--foreground)";
          probe.style.color = "var(--background)";
          document.documentElement.append(probe);
          const expected = getComputedStyle(probe);
          const styles = getComputedStyle(element);
          const matchesTheme =
            styles.backgroundColor === expected.backgroundColor && styles.color === expected.color;
          probe.remove();
          return matchesTheme ? "ok" : "overlay-tokens-mismatch-html-theme";
        }, theme),
      { timeout: 10_000 }
    )
    .toBe("ok");
}

export async function gotoStory(
  page: Page,
  baseURL: string,
  storyId: string,
  theme: ThemeName = "light"
) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(new URL(storyIframePath(storyId, theme), baseURL).toString(), {
    waitUntil: "load",
  });
  const root = page.locator(STORYBOOK_ROOT);
  await root.waitFor({ state: "visible" });
  await page.waitForFunction(
    (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement) || element.childElementCount === 0) {
        return false;
      }

      return element.querySelector("button, [role='combobox'], input, textarea, select") !== null;
    },
    STORYBOOK_ROOT,
    { timeout: 30_000 }
  );
  await waitForStoryTheme(page, theme);
}

export function snapshotName(parts: string[]) {
  return `${parts.join("-")}.png`;
}
