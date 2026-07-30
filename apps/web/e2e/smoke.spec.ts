import { expect, test } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("loads home page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Frontend Platform/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /View examples/i })).toBeVisible();
  });

  test("navigates to examples page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /View examples/i }).click();
    await expect(page.getByRole("heading", { name: /Reference examples/i })).toBeVisible();
  });

  test("examples page lists reference sections", async ({ page }) => {
    await page.goto("/examples");

    await expect(page.getByRole("heading", { name: /Reference examples/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Data fetching/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Forms & validation/i })).toBeVisible();
  });

  test("data example renders", async ({ page }) => {
    await page.goto("/examples/data?mode=success");
    await expect(page.getByRole("heading", { name: /Data fetching/i })).toBeVisible();
  });
});
