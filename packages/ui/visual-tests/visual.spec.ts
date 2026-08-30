import { expect, test, type Page } from "@playwright/test";

import { gotoStory, snapshotName, VIEWPORTS } from "./storybook";

interface VisualCase {
  storyId: string;
  name: string;
  themes: ("light" | "dark")[];
  viewports: (keyof typeof VIEWPORTS)[];
  prepare?: (page: Page) => Promise<void>;
}

const cases: VisualCase[] = [
  {
    storyId: "ui-button--all-variants",
    name: "button-all-variants",
    themes: ["light", "dark"],
    viewports: ["desktop"],
  },
  {
    storyId: "ui-select--keyboard-interaction",
    name: "select-closed",
    themes: ["light", "dark"],
    viewports: ["desktop", "mobile"],
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
  },
  {
    storyId: "ui-tooltip--keyboard-accessibility",
    name: "tooltip-visible",
    themes: ["light", "dark"],
    viewports: ["desktop"],
    prepare: async (page) => {
      await page.getByRole("button", { name: "Show tooltip" }).hover();
      await expect(page.getByRole("tooltip")).toBeVisible();
    },
  },
  {
    storyId: "ui-form--with-error",
    name: "form-error",
    themes: ["light", "dark"],
    viewports: ["desktop", "mobile"],
  },
  {
    storyId: "ui-form--disabled-field",
    name: "form-disabled",
    themes: ["light", "dark"],
    viewports: ["desktop"],
  },
  {
    storyId: "ui-errorfallback--default",
    name: "error-fallback",
    themes: ["light", "dark"],
    viewports: ["desktop", "mobile"],
  },
  {
    storyId: "ui-emptystate--default",
    name: "empty-state",
    themes: ["light", "dark"],
    viewports: ["desktop", "mobile"],
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

        await expect(page).toHaveScreenshot(snapshotName([visualCase.name, theme, viewportName]), {
          clip: { x: 0, y: 0, width: viewport.width, height: viewport.height },
        });
      });
    }
  }
}
