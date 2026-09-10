import { defineConfig, devices } from "@playwright/test";

const host = process.env.STORYBOOK_STATIC_HOST ?? "127.0.0.1";
const port = Number(process.env.STORYBOOK_STATIC_PORT ?? 6010);
const baseURL = `http://${host}:${port}`;

export default defineConfig({
  testDir: "./visual-tests",
  testMatch: "cross-browser.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    reducedMotion: "reduce",
    locale: "en-US",
    timezoneId: "UTC",
    trace: "retain-on-failure",
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
    command: "node scripts/serve-storybook-static.mjs",
    url: `${baseURL}/iframe.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      STORYBOOK_STATIC_HOST: host,
      STORYBOOK_STATIC_PORT: String(port),
    },
  },
});
