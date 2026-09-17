import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  expectOverlayMatchesStoryTheme,
  gotoStory,
  snapshotName,
  STORYBOOK_ROOT,
  VIEWPORTS,
} from "./storybook";

interface VisualCase {
  storyId: string;
  name: string;
  themes: ("light" | "dark")[];
  viewports: (keyof typeof VIEWPORTS)[];
  prepare?: (page: Page) => Promise<void>;
  /** Portaled overlays (dialog, menu, listbox, tooltip) use page-level locators. */
  screenshot?: (page: Page) => Promise<Locator>;
  /** Assert portaled content inherited the requested Storybook html theme before snapshot. */
  assertPortalTheme?: boolean;
}

const cases: VisualCase[] = [
  {
    storyId: "ui-button--all-variants",
    name: "button-all-variants",
    themes: ["light", "dark"],
    viewports: ["desktop"],
    screenshot: async (page) => page.locator(STORYBOOK_ROOT),
  },
  {
    storyId: "ui-select--keyboard-interaction",
    name: "select-closed",
    themes: ["light", "dark"],
    viewports: ["desktop", "mobile"],
    screenshot: async (page) => page.getByRole("combobox"),
  },
  {
    storyId: "ui-select--keyboard-interaction",
    name: "select-open",
    themes: ["light", "dark"],
    viewports: ["desktop", "mobile"],
    prepare: async (page) => {
      await page.getByRole("combobox").click();
      await expect(page.getByRole("listbox")).toBeVisible();
    },
    screenshot: async (page) => page.getByRole("listbox"),
  },
  {
    storyId: "ui-dialog--keyboard-interaction",
    name: "dialog-open",
    themes: ["light", "dark"],
    viewports: ["desktop", "mobile"],
    prepare: async (page) => {
      await page.getByRole("button", { name: "Open Dialog" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
    },
    screenshot: async (page) => page.getByRole("dialog"),
  },
  {
    storyId: "ui-dropdownmenu--keyboard-interaction",
    name: "dropdown-open",
    themes: ["light", "dark"],
    viewports: ["desktop", "mobile"],
    prepare: async (page) => {
      await page.getByRole("button", { name: "Open menu" }).click();
      await expect(page.getByRole("menu")).toBeVisible();
    },
    screenshot: async (page) => page.getByRole("menu"),
  },
  {
    storyId: "ui-tooltip--keyboard-accessibility",
    name: "tooltip-visible",
    themes: ["light", "dark"],
    viewports: ["desktop"],
    prepare: async (page) => {
      const trigger = page.getByRole("button", { name: "Show tooltip" });
      // KeyboardAccessibility's play opens then dismisses the tooltip. Wait for that
      // to finish so the snapshot is a hover-opened, themed portal — not the play race.
      await expect(page.getByRole("tooltip")).toHaveCount(0);
      await trigger.hover();
      await expect(page.getByRole("tooltip")).toBeVisible();
    },
    screenshot: async (page) => page.getByRole("tooltip"),
    assertPortalTheme: true,
  },
  {
    storyId: "ui-form--with-error",
    name: "form-error",
    themes: ["light", "dark"],
    viewports: ["desktop", "mobile"],
    screenshot: async (page) => page.locator(STORYBOOK_ROOT),
  },
  {
    storyId: "ui-form--disabled-field",
    name: "form-disabled",
    themes: ["light", "dark"],
    viewports: ["desktop"],
    screenshot: async (page) => page.locator(STORYBOOK_ROOT),
  },
  {
    storyId: "ui-errorfallback--default",
    name: "error-fallback",
    themes: ["light", "dark"],
    viewports: ["desktop", "mobile"],
    screenshot: async (page) => page.locator(STORYBOOK_ROOT),
  },
  {
    storyId: "ui-emptystate--default",
    name: "empty-state",
    themes: ["light", "dark"],
    viewports: ["desktop", "mobile"],
    screenshot: async (page) => page.locator(STORYBOOK_ROOT),
  },
];

for (const visualCase of cases) {
  for (const theme of visualCase.themes) {
    for (const viewportName of visualCase.viewports) {
      test(`${visualCase.name} ${theme} ${viewportName}`, async ({ page, baseURL }) => {
        const viewport = VIEWPORTS[viewportName];
        await page.setViewportSize(viewport);
        await gotoStory(page, baseURL!, visualCase.storyId, theme);

        if (visualCase.prepare) {
          await visualCase.prepare(page);
        }

        const target = visualCase.screenshot
          ? await visualCase.screenshot(page)
          : page.locator(STORYBOOK_ROOT);

        if (visualCase.assertPortalTheme) {
          await expectOverlayMatchesStoryTheme(target, theme);
        }

        await expect(target).toHaveScreenshot(snapshotName([visualCase.name, theme, viewportName]));
      });
    }
  }
}
