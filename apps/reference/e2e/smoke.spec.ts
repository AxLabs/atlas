import { expect, test } from "@playwright/test";

test.describe("Reference application smoke", () => {
  test("loads overview with harness link for anonymous visitors", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Sign in required")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open harness" })).toBeVisible();
  });

  test("harness page is reachable", async ({ page }) => {
    await page.goto("/harness");
    await expect(page.getByRole("status")).toContainText("Reference mode active");
  });
});
