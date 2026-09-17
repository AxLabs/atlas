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

async function highlightedSelectOption(page: Page) {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.getAttribute("role") === "option") {
      return (active.textContent || "").replace(/\s+/g, " ").trim();
    }

    const highlighted = document.querySelector<HTMLElement>(
      '[role="option"][data-highlighted], [role="option"][data-active], [role="option"][aria-current="true"]'
    );
    if (highlighted) {
      return (highlighted.textContent || "").replace(/\s+/g, " ").trim();
    }

    const listbox = document.querySelector("[role='listbox']");
    const activeId = listbox?.getAttribute("aria-activedescendant");
    if (activeId) {
      const option = document.getElementById(activeId);
      if (option) {
        return (option.textContent || "").replace(/\s+/g, " ").trim();
      }
    }

    return null;
  });
}

// Strictly `document.activeElement`, unlike `highlightedSelectOption`'s `data-highlighted`/
// `aria-activedescendant` fallbacks: this is the exact element a subsequent
// `page.keyboard.press("Enter")` will target, so polling this specifically (rather than the
// broader visual-highlight signal) proves real DOM focus reached the matched option before commit.
async function focusedOptionLabel(page: Page) {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.getAttribute("role") === "option") {
      return (active.textContent || "").replace(/\s+/g, " ").trim();
    }
    return null;
  });
}

test.describe("Select keyboard composition", () => {
  test("opens, navigates, selects, and restores focus", async ({ page, baseURL }) => {
    await gotoStory(page, baseURL!, "ui-select--keyboard-interaction", "light", {
      disablePlay: true,
    });

    const trigger = story(page).getByRole("combobox", { name: "Framework" });
    const listbox = page.getByRole("listbox");
    await expect(listbox).toHaveCount(0);
    await expect(trigger).toContainText("Next.js");
    await trigger.focus();
    await expect(trigger).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await expect(listbox).toBeVisible();

    // Typeahead is the keyboard navigation both engines expose. ArrowDown while
    // focus stays on the combobox does not move the highlighted option in WebKit.
    await page.keyboard.press("r");
    await expect.poll(async () => highlightedSelectOption(page)).toBe("React");

    // Base UI moves real DOM focus to the matched option on a scheduled animation frame rather
    // than synchronously with the typeahead match, so the visual highlight above can settle
    // before focus itself lands. Wait for focus specifically — not just the highlight signal —
    // so Enter (which only commits when it targets the highlighted option directly) is
    // dispatched to "React" in every engine instead of racing a still-in-flight focus move.
    await expect.poll(async () => focusedOptionLabel(page)).toBe("React");

    // Select from the existing keyboard state (no option `.click()`/`.press()`), so this proves a
    // genuine end-to-end keyboard action rather than a locator-focused synthetic key dispatch.
    await page.keyboard.press("Enter");
    await expect(listbox).toHaveCount(0);
    await expect(trigger).toContainText("React");
    await expect(trigger).toBeFocused();
  });
});

test.describe("Dialog keyboard composition", () => {
  test("opens, keeps keyboard focus inside (boundary probe), closes, and restores focus", async ({
    page,
    baseURL,
  }) => {
    await gotoStory(page, baseURL!, "ui-dialog--keyboard-interaction", "light", {
      disablePlay: true,
    });

    const trigger = story(page).getByRole("button", { name: "Open Dialog" });
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveCount(0);
    await trigger.focus();
    await expect(trigger).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();

    const cancel = dialog.getByRole("button", { name: "Cancel" });
    const continueButton = dialog.getByRole("button", { name: "Continue" });
    await expect(cancel).toBeVisible();
    await expect(continueButton).toBeVisible();
    await focusByTabbing(cancel, page);
    await expect(cancel).toBeFocused();
    await expectFocusInside(dialog);

    await page.keyboard.press("Tab");
    await expect(continueButton).toBeFocused();
    await expect(cancel).toBeVisible();
    await expectFocusInside(dialog);

    await continueButton.press("Shift+Tab");
    await expect(cancel).toBeVisible();
    await expect(cancel).toBeFocused();
    await expectFocusInside(dialog);

    // Boundary probe: Tab past the last known control. Focus must remain inside the dialog
    // (Base UI may cycle to its own focus-guard sentinel elements rather than the first visible
    // control). We accept that outcome — the intent is that focus cannot escape to the host page.
    // Do not assert the exact first/last wrap element to avoid cross-engine flakiness.
    await page.keyboard.press("Tab");
    await expectFocusInside(dialog);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe("DropdownMenu keyboard composition", () => {
  test("opens, reaches items, activates, and restores focus", async ({ page, baseURL }) => {
    await gotoStory(page, baseURL!, "ui-dropdownmenu--keyboard-interaction", "light", {
      disablePlay: true,
    });

    const trigger = story(page).getByRole("button", { name: "Open menu" });
    const menu = page.getByRole("menu");
    await expect(menu).toHaveCount(0);
    await expect(story(page).getByTestId("selected-item")).toHaveCount(0);
    await trigger.focus();
    await expect(trigger).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await expect(menu).toBeVisible();

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe("Tooltip keyboard accessibility", () => {
  test("opens on keyboard focus and dismisses with Escape", async ({ page, baseURL }) => {
    await gotoStory(page, baseURL!, "ui-tooltip--keyboard-accessibility", "light", {
      disablePlay: true,
    });

    const trigger = story(page).getByRole("button", { name: "Show tooltip" });
    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toHaveCount(0);

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await page.keyboard.press("Tab");
      if (await trigger.evaluate((element) => element === document.activeElement)) {
        break;
      }
    }
    await expect(trigger).toBeFocused();
    await expect(tooltip).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(tooltip).toHaveCount(0);
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

test.describe("Form keyboard/focus coverage", () => {
  test("Tab reaches the enabled input; error state survives keyboard interaction", async ({
    page,
    baseURL,
  }) => {
    await gotoStory(page, baseURL!, "ui-form--with-error");

    const password = story(page).getByLabel("Password");
    // Tab from a non-focused state until the password input is reached (max 6 attempts).
    await focusByTabbing(password, page, 6);
    await expect(password).toBeFocused();
    // Keyboard focus must not clear the error state — aria-invalid and the accessible description
    // must survive Tab-in.
    await expect(password).toHaveAttribute("aria-invalid", "true");
    await expect(password).toHaveAccessibleDescription(/at least 8 characters/i);
  });

  test("disabled form field is not keyboard-focusable via Tab", async ({ page, baseURL }) => {
    await gotoStory(page, baseURL!, "ui-form--disabled-field");

    const email = story(page).getByLabel("Email");
    await expect(email).toBeDisabled();

    // Tab up to 8 times: the disabled input must never become the active element.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await page.keyboard.press("Tab");
      const isEmailFocused = await email.evaluate((element) => element === document.activeElement);
      expect(isEmailFocused, "Disabled field received Tab focus").toBe(false);
    }
  });
});

test.describe("Button rendering semantics", () => {
  test("activates native buttons with keyboard", async ({ page, baseURL }) => {
    await gotoStory(page, baseURL!, "ui-button--native-semantics");

    const button = story(page).getByRole("button", { name: "Save changes" });
    await expect(button).toBeEnabled();
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(story(page).getByText("Saved")).toBeVisible();

    const disabled = story(page).getByRole("button", { name: "Disabled action" });
    await expect(disabled).toBeDisabled();
  });
});
