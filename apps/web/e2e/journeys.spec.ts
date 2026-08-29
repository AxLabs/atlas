import { expect, test } from "@playwright/test";

test.describe("Critical web journeys", () => {
  test("data example empty, error, and retry states", async ({ page }) => {
    await page.goto("/examples/data?mode=empty");
    await expect(page.getByRole("heading", { name: /Data fetching/i })).toBeVisible();
    await expect(page.getByText("No items yet")).toBeVisible();

    await page.goto("/examples/data?mode=error");
    await expect(page.getByRole("heading", { name: "Failed to load items" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Success" }).click();
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("form example client validation blocks empty submit", async ({ page }) => {
    await page.goto("/examples/form");
    await expect(page.getByRole("heading", { name: /Forms & validation/i })).toBeVisible();
    await page.getByLabel("Title *").fill("ab");
    await page.getByRole("button", { name: "Create item" }).click();
    await expect(page.getByText("Title must be at least 3 characters")).toBeVisible();
  });

  test("desktop examples navigation stays reachable", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/examples");
    await page.getByRole("link", { name: "Forms" }).click();
    await expect(page.getByRole("heading", { name: /Forms & validation/i })).toBeVisible();
  });
});
