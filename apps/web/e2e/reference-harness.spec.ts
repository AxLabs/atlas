import { test, expect } from "@playwright/test";

test.describe("Reference harness", () => {
  test("exercises authenticated reference flow without external credentials", async ({ page }) => {
    await page.goto("/reference");
    await expect(page.getByRole("status")).toContainText("Reference mode active");

    await page.getByRole("button", { name: "reference-user" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();

    await page.getByRole("button", { name: "success" }).click();
    await expect(page.getByText("Reference User (reference.user@atlas.local)")).toBeVisible();
  });
});
