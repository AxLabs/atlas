import { test, expect } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  await request.post("/api/reset");
});

test.describe("Reference harness", () => {
  test("exercises authenticated reference flow without external credentials", async ({ page }) => {
    await page.goto("/harness");
    await expect(page.getByText("Reference mode active")).toBeVisible();

    await page.getByRole("button", { name: "reference-user" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();

    await page.getByRole("button", { name: "success" }).click();
    await expect(page.getByText(/Scenario set to success/)).toBeVisible();
    await expect(page.getByText("Reference User (reference.user@atlas.local)")).toBeVisible();
  });
});

test.describe("Reference application", () => {
  test("anonymous visitor sees auth-required state on overview", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Sign in required")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open harness" })).toBeVisible();
  });

  test("reference-user can view users list in success scenario", async ({ page }) => {
    await page.goto("/harness");
    await page.getByRole("button", { name: "reference-user" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();
    await page.getByRole("button", { name: "success" }).click();
    await expect(page.getByText(/Scenario set to success/)).toBeVisible();

    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Reference User", exact: true })).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "reference.user@atlas.local", exact: true })
    ).toBeVisible();
  });

  test("reference-admin can create a user", async ({ page }) => {
    const uniqueEmail = `create-${Date.now()}@atlas.local`;

    await page.goto("/harness");
    await page.getByRole("button", { name: "reference-admin" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();
    await page.getByRole("button", { name: "success" }).click();
    await expect(page.getByText(/Scenario set to success/)).toBeVisible();

    await page.goto("/users/new");
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Name").fill("New Reference User");
    await page.getByRole("button", { name: "Create user" }).click();

    await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
    await expect(page.getByRole("cell", { name: uniqueEmail, exact: true })).toBeVisible();
  });

  test("validation scenario surfaces server field errors on create", async ({ page }) => {
    await page.goto("/harness");
    await page.getByRole("button", { name: "reference-admin" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();
    await page.getByRole("button", { name: "validation" }).click();
    await expect(page.getByText(/Scenario set to validation/)).toBeVisible();

    await page.goto("/users/new");
    await page.getByLabel("Email").fill("valid@atlas.local");
    await page.getByLabel("Name").fill("Valid Name");
    await page.getByRole("button", { name: "Create user" }).click();

    await expect(page.getByText("Email is invalid")).toBeVisible();
    await expect(page.getByText("Name is required")).toBeVisible();
  });

  test("server-error scenario shows retry path on users list", async ({ page }) => {
    await page.goto("/harness");
    await page.getByRole("button", { name: "reference-user" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();
    await page.getByRole("button", { name: "server-error" }).click();
    await expect(page.getByText(/Scenario set to server-error/)).toBeVisible();

    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Failed to load users" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("mobile navigation reaches users list", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/harness");
    await page.getByRole("button", { name: "reference-user" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();
    await page.getByRole("button", { name: "success" }).click();
    await expect(page.getByText(/Scenario set to success/)).toBeVisible();

    await page.goto("/");
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Users" }).click();

    await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Reference User", exact: true })).toBeVisible();
  });

  test("authenticated evaluator discovers major capability links on overview", async ({ page }) => {
    await page.goto("/harness");
    await page.getByRole("button", { name: "reference-user" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Capability map", level: 2 })).toBeVisible();
    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: "Authorization" })).toBeVisible();
    await expect(main.getByRole("link", { name: "Feature flags" })).toHaveAttribute(
      "href",
      "/platform"
    );
    await expect(main.getByRole("link", { name: "Theming" })).toHaveAttribute("href", "/settings");
  });

  test("settings theme preference persists across navigation", async ({ page }) => {
    await page.goto("/harness");
    await page.getByRole("button", { name: "reference-user" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();

    await page.goto("/settings");
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await expect(page.getByText("Current preference: dark")).toBeVisible();

    await page.goto("/users");
    await page.goto("/settings");
    await expect(page.getByText("Current preference: dark")).toBeVisible();
  });

  test("platform runtime diagnostics render without obvious secrets", async ({ page }) => {
    await page.goto("/harness");
    await page.getByRole("button", { name: "reference-user" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();

    await page.goto("/platform");
    await expect(
      page.getByRole("heading", { name: "Platform diagnostics", level: 1 })
    ).toBeVisible();
    await expect(page.getByText("@atlas/reference")).toBeVisible();
    await expect(page.getByText("Feature flags")).toBeVisible();

    const bodyText = await page.locator("main").innerText();
    expect(bodyText).not.toMatch(
      /AUTH_SESSION_SECRET|GOOGLE_CLIENT_SECRET|SENTRY_AUTH_TOKEN|DATABASE_URL/
    );
  });

  test("platform controlled failure returns correlation ID", async ({ page }) => {
    await page.goto("/harness");
    await page.getByRole("button", { name: "reference-user" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();
    await page.getByRole("button", { name: "server-error" }).click();

    await page.goto("/platform");
    await page.getByRole("button", { name: "Trigger controlled failure" }).click();
    await expect(page.getByText(/Correlation ID:/i)).toBeVisible({ timeout: 10000 });
  });

  test("mobile navigation reaches settings and platform", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/harness");
    await page.getByRole("button", { name: "reference-user" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();

    await page.goto("/");
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();

    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Platform" }).click();
    await expect(
      page.getByRole("heading", { name: "Platform diagnostics", level: 1 })
    ).toBeVisible();
  });
});

test.describe("Authorization", () => {
  test("reference-user is denied protected delete via direct API", async ({ page }) => {
    await page.goto("/harness");
    await page.getByRole("button", { name: "reference-user" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();

    await page.getByRole("button", { name: "Direct delete API call (bypasses UI gate)" }).click();
    await expect(page.getByText(/Delete denied or failed/i)).toBeVisible({ timeout: 10000 });
  });

  test("reference-user cannot access server-protected route", async ({ page }) => {
    await page.goto("/harness");
    await page.getByRole("button", { name: "reference-user" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();

    await page.goto("/authorization");
    await expect(page.getByRole("heading", { name: "Permission denied" })).toBeVisible();
  });

  test("reference-admin can perform protected actions", async ({ page }) => {
    await page.goto("/harness");
    await page.getByRole("button", { name: "reference-admin" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();
    await expect(page.getByText("users.delete")).toBeVisible();

    await expect(
      page.getByRole("button", { name: "Delete reference user (UI gated)" })
    ).toBeVisible();

    await page.goto("/authorization");
    await expect(page.getByText("Server-protected content")).toBeVisible();
  });

  test("reference-admin is denied protected update by resource policy", async ({ page }) => {
    await page.goto("/harness");
    await page.getByRole("button", { name: "reference-admin" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();

    await page.getByRole("button", { name: "Update protected admin (resource policy)" }).click();
    await expect(page.getByText(/Update denied or failed/i)).toBeVisible({ timeout: 10000 });
  });

  test("reference-user does not see create user action on users list", async ({ page }) => {
    await page.goto("/harness");
    await page.getByRole("button", { name: "reference-user" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();
    await page.getByRole("button", { name: "success" }).click();
    await expect(page.getByText(/Scenario set to success/)).toBeVisible();

    await page.goto("/users");
    await expect(page.getByRole("link", { name: "New user" })).toHaveCount(0);
  });

  test("reference-admin sees create user action on users list", async ({ page }) => {
    await page.goto("/harness");
    await page.getByRole("button", { name: "reference-admin" }).click();
    await expect(page.getByText(/Session status: authenticated/)).toBeVisible();
    await page.getByRole("button", { name: "success" }).click();
    await expect(page.getByText(/Scenario set to success/)).toBeVisible();

    await page.goto("/users");
    await expect(page.getByRole("link", { name: "New user" })).toBeVisible();
  });
});
