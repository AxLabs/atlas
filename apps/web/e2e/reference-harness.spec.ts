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

test.describe("Authorization", () => {
  test("reference-user is denied protected delete via direct API", async ({ page }) => {
    await page.goto("/reference");
    await page.getByRole("button", { name: "reference-user" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();

    await page.getByRole("button", { name: "Direct delete API call (bypasses UI gate)" }).click();
    await expect(page.getByText(/Delete denied or failed/i)).toBeVisible({ timeout: 10000 });
  });

  test("reference-user cannot access server-protected route", async ({ page }) => {
    await page.goto("/reference");
    await page.getByRole("button", { name: "reference-user" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();

    await page.goto("/reference/authorization");
    await expect(page.getByRole("heading", { name: "Permission denied" })).toBeVisible();
  });

  test("reference-admin can perform protected actions", async ({ page }) => {
    await page.goto("/reference");
    await page.getByRole("button", { name: "reference-admin" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();
    await expect(page.getByText("users.delete")).toBeVisible();

    await expect(
      page.getByRole("button", { name: "Delete reference user (UI gated)" })
    ).toBeVisible();

    await page.goto("/reference/authorization");
    await expect(page.getByText("Server-protected content")).toBeVisible();
  });

  test("reference-admin is denied protected update by resource policy", async ({ page }) => {
    await page.goto("/reference");
    await page.getByRole("button", { name: "reference-admin" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();

    await page.getByRole("button", { name: "Update protected admin (resource policy)" }).click();
    await expect(page.getByText(/Update denied or failed/i)).toBeVisible({ timeout: 10000 });
  });
});
