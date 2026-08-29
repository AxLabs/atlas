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
  page: import("@playwright/test").Page,
  baseURL: string,
  storyId: string,
  theme: ThemeName = "light"
) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(new URL(storyIframePath(storyId, theme), baseURL).toString(), {
    waitUntil: "networkidle",
  });
  await page.locator(STORYBOOK_ROOT).waitFor({ state: "visible" });
  await page.waitForTimeout(150);
}

export function snapshotName(parts: string[]) {
  return `${parts.join("-")}.png`;
}
