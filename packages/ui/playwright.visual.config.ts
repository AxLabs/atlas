import { defineConfig, devices } from "@playwright/test";

const host = process.env.STORYBOOK_STATIC_HOST ?? "127.0.0.1";
const port = Number(process.env.STORYBOOK_STATIC_PORT ?? 6006);
const baseURL = `http://${host}:${port}`;

export default defineConfig({
  testDir: "./visual-tests",
  testMatch: "visual.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: "list",
  snapshotPathTemplate: "{testDir}/__snapshots__/{testFilePath}/{arg}{-projectName}{ext}",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
    },
  },
  use: {
    baseURL,
    reducedMotion: "reduce",
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "light",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
      },
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
