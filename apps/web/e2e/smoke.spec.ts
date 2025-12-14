import { expect, test } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("loads home page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Frontend Platform/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /View Demo/i })).toBeVisible();
  });

  test("navigates to demo page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /View Demo/i }).click();
    await expect(page.getByRole("heading", { name: /Component Demo/i })).toBeVisible();
  });

  test("demo page components render", async ({ page }) => {
    await page.goto("/demo");

    // Check if various components are rendered
    await expect(page.getByRole("heading", { name: /Buttons/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Alerts/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Empty State/i })).toBeVisible();
  });

  test("demo page interactions work", async ({ page }) => {
    await page.goto("/demo");

    // Test button click
    await page.getByRole("button", { name: "Success Toast" }).click();

    // Test error toggle
    await page.getByRole("button", { name: "Toggle Error" }).click();
    await expect(page.getByText(/Something went wrong/i)).toBeVisible();
  });
});
