import { expect, test, type Locator, type Page } from "@playwright/test";

import { gotoStory, STORYBOOK_ROOT } from "./storybook";

function story(page: Page) {
  return page.locator(STORYBOOK_ROOT);
}

async function expectFocusInside(container: Locator) {
  await expect
    .poll(async () => container.evaluate((element) => element.contains(document.activeElement)), {
      timeout: 10_000,
    })
    .toBe(true);
}

async function focusByTabbing(target: Locator, page: Page, maxAttempts = 8) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) {
      return;
    }
    await page.keyboard.press("Tab");
  }
}

test.describe("Select keyboard composition", () => {
  test("opens, navigates, selects, and restores focus", async ({ page, baseURL }) => {
    await gotoStory(page, baseURL!, "ui-select--keyboard-interaction");

    const trigger = story(page).getByRole("combobox", { name: "Framework" });
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("listbox")).toBeVisible();

    await page.getByRole("option", { name: "React" }).click();
    await expect(trigger).toContainText("React");

    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  });
});

test.describe("Dialog keyboard composition", () => {
  test("opens, traps focus, closes, and restores focus", async ({ page, baseURL }) => {
    await gotoStory(page, baseURL!, "ui-dialog--keyboard-interaction");

    const trigger = story(page).locator('button[aria-label="Open Dialog"]');
    await trigger.waitFor({ state: "visible", timeout: 30_000 });
    await trigger.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const cancel = dialog.getByRole("button", { name: "Cancel" });
    const continueButton = dialog.getByRole("button", { name: "Continue" });
    await focusByTabbing(cancel, page);
    await expect(cancel).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(continueButton).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(cancel).toBeFocused();
    await expectFocusInside(dialog);

    await page.keyboard.press("Shift+Tab");
    await expect(continueButton).toBeFocused();
    await expectFocusInside(dialog);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe("DropdownMenu keyboard composition", () => {
  test("opens, reaches items, activates, and restores focus", async ({ page, baseURL }) => {
    await gotoStory(page, baseURL!, "ui-dropdownmenu--keyboard-interaction");

    const trigger = story(page).getByRole("button", { name: "Open menu" });
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menu")).toBeVisible();

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe("Tooltip keyboard accessibility", () => {
  test("opens on keyboard focus and dismisses with Escape", async ({ page, baseURL }) => {
    await gotoStory(page, baseURL!, "ui-tooltip--keyboard-accessibility");

    const trigger = story(page).getByRole("button", { name: "Show tooltip" });
    await expect(page.getByRole("tooltip")).toHaveCount(0);

    await focusByTabbing(trigger, page);
    await expect(trigger).toBeFocused();
    await expect(page.getByRole("tooltip")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});

test.describe("Form accessibility composition", () => {
  test("associates labels, help text, and errors", async ({ page, baseURL }) => {
    await gotoStory(page, baseURL!, "ui-form--with-error");

    const password = story(page).getByLabel("Password");
    await expect(password).toHaveAttribute("aria-invalid", "true");
    await expect(password).toHaveAccessibleDescription(/at least 8 characters/i);
    await expect(story(page).getByRole("alert")).toBeVisible();
  });
});

test.describe("Button rendering semantics", () => {
  test("activates native buttons with keyboard", async ({ page, baseURL }) => {
    await gotoStory(page, baseURL!, "ui-button--native-semantics");

    const button = story(page).getByRole("button", { name: "Save changes" });
    await expect(button).toBeEnabled();
    await button.focus();
    await page.keyboard.press("Space");
    await expect(story(page).getByText("Saved")).toBeVisible();

    const disabled = story(page).getByRole("button", { name: "Disabled action" });
    await expect(disabled).toBeDisabled();
  });
});
