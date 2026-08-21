import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "corepack pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      // Self-hosted CI runners may export NODE_ENV=production; reference mode must stay off in prod builds
      // but E2E exercises reference adapters via the dev server.
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_ENV: "development",
      ATLAS_REFERENCE_MODE: "true",
      NEXT_PUBLIC_API_URL: "/api/reference",
      AUTH_SESSION_SECRET:
        process.env.AUTH_SESSION_SECRET ?? "local-reference-session-secret-32chars",
    },
  },
});
