import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

const host = process.env.STORYBOOK_STATIC_HOST ?? "127.0.0.1";
const port = Number(process.env.STORYBOOK_STATIC_PORT ?? 6006);
const baseURL = `http://${host}:${port}`;

const CANONICAL_PLAYWRIGHT_BROWSERS = "/ms-playwright";
if (!existsSync(CANONICAL_PLAYWRIGHT_BROWSERS) && process.env.ATLAS_ALLOW_HOST_VISUAL !== "1") {
  throw new Error(
    "Visual baselines are compared only in mcr.microsoft.com/playwright:v<playwright-version>-noble. " +
      "Run `pnpm --filter @atlas/ui test:visual:docker` (or the Update Visual Baselines workflow). " +
      "Do not compare or --update-snapshots with host Chromium; font metrics differ and will not match shipped PNGs."
  );
}

export default defineConfig({
  testDir: "./visual-tests",
  testMatch: "visual.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: process.env.CI
    ? [["list"], ["html", { outputFolder: "playwright-report-visual", open: "never" }]]
    : "list",
  snapshotPathTemplate: "{testDir}/__snapshots__/{testFilePath}/{arg}{-projectName}{ext}",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      // Canonical baselines are Chromium captures from
      // mcr.microsoft.com/playwright:v<playwright-version>-noble (hosted and Turing).
      // A tight ratio absorbs residual font/antialias rasterization between runs
      // without restoring the previous 1% full-viewport slack.
      maxDiffPixelRatio: 0.005,
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
