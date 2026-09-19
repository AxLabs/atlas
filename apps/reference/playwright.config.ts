import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  failOnFlakyTests: Boolean(process.env.CI),
  workers: process.env.CI ? 2 : 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: {
    command: "corepack pnpm dev",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_ENV: "development",
      NEXT_PUBLIC_API_URL: "/api",
      NEXT_PUBLIC_APP_URL: "http://localhost:3001",
      AUTH_SESSION_SECRET:
        process.env.AUTH_SESSION_SECRET ?? "local-reference-session-secret-32chars",
      NEXT_PUBLIC_CONSENT_ENABLED: "true",
      NEXT_PUBLIC_CONSENT_MODE: "opt-in",
    },
  },
});
