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
    await expect(
      page.getByRole("heading", { name: /The Foundation for your Design System/i })
    ).toBeVisible();
  });

  test("demo page components render", async ({ page }) => {
    await page.goto("/demo");

    // Check if various sections are rendered
    await expect(page.getByText("Atlas UI Components")).toBeVisible();
    await expect(page.getByText("Name on Card")).toBeVisible();
    await expect(page.getByText("No Team Members")).toBeVisible();
  });

  test("demo page interactions work", async ({ page }) => {
    await page.goto("/demo");

    // Test that interactive elements are present
    await expect(page.getByRole("button", { name: /New Project/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /View Components/i })).toBeVisible();

    // Test form elements are present
    await expect(page.getByPlaceholder("Ask, search, or make anything...")).toBeVisible();
  });
});
