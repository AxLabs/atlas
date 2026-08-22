import { test, expect } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  await request.post("/api/reference/reset");
});

test.describe("Reference harness", () => {
  test("exercises authenticated reference flow without external credentials", async ({ page }) => {
    await page.goto("/reference/harness");
    await expect(page.getByRole("status")).toContainText("Reference mode active");

    await page.getByRole("button", { name: "reference-user" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();

    await page.getByRole("button", { name: "success" }).click();
    await expect(page.getByText(/Scenario set to success/)).toBeVisible();
    await expect(page.getByText("Reference User (reference.user@atlas.local)")).toBeVisible();
  });
});

test.describe("Reference application", () => {
  test("anonymous visitor sees auth-required state on overview", async ({ page }) => {
    await page.goto("/reference");
    await expect(page.getByText("Sign in required")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open harness" })).toBeVisible();
  });

  test("reference-user can view users list in success scenario", async ({ page }) => {
    await page.goto("/reference/harness");
    await page.getByRole("button", { name: "reference-user" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();
    await page.getByRole("button", { name: "success" }).click();
    await expect(page.getByText(/Scenario set to success/)).toBeVisible();

    await page.goto("/reference/users");
    await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Reference User", exact: true })).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "reference.user@atlas.local", exact: true })
    ).toBeVisible();
  });

  test("reference-admin can create a user", async ({ page }) => {
    await page.goto("/reference/harness");
    await page.getByRole("button", { name: "reference-admin" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();
    await page.getByRole("button", { name: "success" }).click();
    await expect(page.getByText(/Scenario set to success/)).toBeVisible();

    await page.goto("/reference/users/new");
    await page.getByLabel("Email").fill("new.user@atlas.local");
    await page.getByLabel("Name").fill("New Reference User");
    await page.getByRole("button", { name: "Create user" }).click();

    await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
    await expect(page.getByText("new.user@atlas.local")).toBeVisible();
  });

  test("validation scenario surfaces server field errors on create", async ({ page }) => {
    await page.goto("/reference/harness");
    await page.getByRole("button", { name: "reference-admin" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();
    await page.getByRole("button", { name: "validation" }).click();
    await expect(page.getByText(/Scenario set to validation/)).toBeVisible();

    await page.goto("/reference/users/new");
    await page.getByLabel("Email").fill("valid@atlas.local");
    await page.getByLabel("Name").fill("Valid Name");
    await page.getByRole("button", { name: "Create user" }).click();

    await expect(page.getByText("Email is invalid")).toBeVisible();
    await expect(page.getByText("Name is required")).toBeVisible();
  });

  test("server-error scenario shows retry path on users list", async ({ page }) => {
    await page.goto("/reference/harness");
    await page.getByRole("button", { name: "reference-user" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();
    await page.getByRole("button", { name: "server-error" }).click();
    await expect(page.getByText(/Scenario set to server-error/)).toBeVisible();

    await page.goto("/reference/users");
    await expect(page.getByRole("heading", { name: "Failed to load users" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});

test.describe("Authorization", () => {
  test("reference-user is denied protected delete via direct API", async ({ page }) => {
    await page.goto("/reference/harness");
    await page.getByRole("button", { name: "reference-user" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();

    await page.getByRole("button", { name: "Direct delete API call (bypasses UI gate)" }).click();
    await expect(page.getByText(/Delete denied or failed/i)).toBeVisible({ timeout: 10000 });
  });

  test("reference-user cannot access server-protected route", async ({ page }) => {
    await page.goto("/reference/harness");
    await page.getByRole("button", { name: "reference-user" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();

    await page.goto("/reference/authorization");
    await expect(page.getByRole("heading", { name: "Permission denied" })).toBeVisible();
  });

  test("reference-admin can perform protected actions", async ({ page }) => {
    await page.goto("/reference/harness");
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
    await page.goto("/reference/harness");
    await page.getByRole("button", { name: "reference-admin" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();

    await page.getByRole("button", { name: "Update protected admin (resource policy)" }).click();
    await expect(page.getByText(/Update denied or failed/i)).toBeVisible({ timeout: 10000 });
  });

  test("reference-user does not see create user action on users list", async ({ page }) => {
    await page.goto("/reference/harness");
    await page.getByRole("button", { name: "reference-user" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();
    await page.getByRole("button", { name: "success" }).click();
    await expect(page.getByText(/Scenario set to success/)).toBeVisible();

    await page.goto("/reference/users");
    await expect(page.getByRole("link", { name: "New user" })).toHaveCount(0);
  });

  test("reference-admin sees create user action on users list", async ({ page }) => {
    await page.goto("/reference/harness");
    await page.getByRole("button", { name: "reference-admin" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();
    await page.getByRole("button", { name: "success" }).click();
    await expect(page.getByText(/Scenario set to success/)).toBeVisible();

    await page.goto("/reference/users");
    await expect(page.getByRole("link", { name: "New user" })).toBeVisible();
  });
});
