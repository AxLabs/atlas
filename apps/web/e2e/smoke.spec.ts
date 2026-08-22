import { expect, test } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("loads home page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Project ready!/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Button/i })).toBeVisible();
  });

  test("navigates to examples page", async ({ page }) => {
    await page.goto("/examples");
    await expect(page.getByRole("heading", { name: /Reference examples/i })).toBeVisible();
  });

  test("examples page lists reference sections", async ({ page }) => {
    await page.goto("/examples");

    await expect(page.getByRole("heading", { name: /Reference examples/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Data states" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Forms" })).toBeVisible();
  });

  test("data example renders", async ({ page }) => {
    await page.goto("/examples/data?mode=success");
    await expect(page.getByRole("heading", { name: /Data fetching/i })).toBeVisible();
  });

  test("does not expose reference product routes", async ({ page }) => {
    const response = await page.goto("/reference");
    expect(response?.status()).toBe(404);
  });
});
