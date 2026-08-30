import type { Page } from "@playwright/test";

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
      return element instanceof HTMLElement && element.childElementCount > 0;
    },
    STORYBOOK_ROOT,
    { timeout: 15_000 }
  );
  await page.waitForTimeout(150);
}

export function snapshotName(parts: string[]) {
  return `${parts.join("-")}.png`;
}
