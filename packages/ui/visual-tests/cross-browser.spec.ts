import { expect, test } from "@playwright/test";

import { gotoStory } from "./storybook";

test.describe("Select keyboard composition", () => {
  test("opens, navigates, selects, and restores focus", async ({ page, baseURL }) => {
    await gotoStory(page, baseURL!, "ui-select--keyboard-interaction");

    const trigger = page.getByRole("combobox", { name: "Framework" });
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
  test("opens, traps focus, and closes with Escape", async ({ page, baseURL }) => {
    await gotoStory(page, baseURL!, "ui-dialog--keyboard-interaction");

    const trigger = page.getByRole("button", { name: "Open Dialog" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe("DropdownMenu keyboard composition", () => {
  test("opens, reaches items, activates, and restores focus", async ({ page, baseURL }) => {
    await gotoStory(page, baseURL!, "ui-dropdownmenu--keyboard-interaction");

    const trigger = page.getByRole("button", { name: "Open menu" });
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
  test("exposes a keyboard-reachable trigger", async ({ page, baseURL }) => {
    await gotoStory(page, baseURL!, "ui-tooltip--keyboard-accessibility");

    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Show tooltip" })).toBeFocused();
  });
});

test.describe("Form accessibility composition", () => {
  test("associates labels, help text, and errors", async ({ page, baseURL }) => {
    await gotoStory(page, baseURL!, "ui-form--with-error");

    const password = page.getByLabel("Password");
    await expect(password).toHaveAttribute("aria-invalid", "true");
    await expect(password).toHaveAccessibleDescription(/at least 8 characters/i);
    await expect(page.getByRole("alert")).toBeVisible();
  });
});

test.describe("Button rendering semantics", () => {
  test("activates native buttons with keyboard", async ({ page, baseURL }) => {
    await gotoStory(page, baseURL!, "ui-button--native-semantics");

    const button = page.getByRole("button", { name: "Save changes" });
    await expect(button).toBeEnabled();
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Saved")).toBeVisible();

    const disabled = page.getByRole("button", { name: "Disabled action" });
    await expect(disabled).toBeDisabled();
  });
});
