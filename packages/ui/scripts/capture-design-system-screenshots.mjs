#!/usr/bin/env node
/**
 * Captures Design System/Atlas Storybook screenshots for local PR review.
 *
 * Usage (from packages/ui):
 *   pnpm build-storybook
 *   node scripts/capture-design-system-screenshots.mjs [outputDir]
 *
 * Output defaults to design-system-screenshots/ (gitignored). Requires Playwright
 * browsers from apps/web: pnpm --filter @atlas/web exec playwright install chromium
 */

import { spawn } from "node:child_process";
import { access, mkdir, readFile } from "node:fs/promises";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageRoot, "../..");
const outputRoot = path.resolve(
  packageRoot,
  process.argv[2] ?? "design-system-screenshots"
);

const stories = [
  { id: "design-system-atlas--page-header-actions", name: "page-header-actions" },
  { id: "design-system-atlas--button-variants", name: "button-variants" },
  { id: "design-system-atlas--form-screen", name: "form-screen" },
  { id: "design-system-atlas--badge-variants", name: "badge-variants" },
  { id: "design-system-atlas--switch-states", name: "switch-states" },
];

const themes = [
  { name: "light", className: "" },
  { name: "dark", className: "dark" },
];

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function resolvePlaywright() {
  const requireFromWeb = createRequire(path.join(repoRoot, "apps/web/package.json"));
  return requireFromWeb("@playwright/test");
}

async function ensureStorybook() {
  const staticDir = path.join(packageRoot, "storybook-static");
  if (!(await fileExists(path.join(staticDir, "index.html")))) {
    console.log("Building Storybook static site…");
    await run("pnpm", ["build-storybook"], { cwd: packageRoot });
  }

  return { staticDir };
}

const contentTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

async function startStaticServer(staticDir) {
  const server = http.createServer((request, response) => {
    const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const relativePath = requestPath === "/" ? "/index.html" : requestPath;
    const filePath = path.join(staticDir, relativePath);

    readFile(filePath)
      .then((data) => {
        const ext = path.extname(filePath);
        const contentType = contentTypes[ext] ?? "application/octet-stream";
        response.writeHead(200, { "Content-Type": contentType });
        response.end(data);
      })
      .catch(() => {
        response.writeHead(404);
        response.end("Not found");
      });
  });

  await new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  return {
    url: `http://127.0.0.1:${port}/iframe.html`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

async function captureScreenshots(server, playwright) {
  const { chromium } = playwright;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  try {
    for (const theme of themes) {
      for (const story of stories) {
        const target = `${server.url}?id=${story.id}&viewMode=story`;
        await page.goto(target, { waitUntil: "networkidle" });
        await page.evaluate((className) => {
          document.documentElement.classList.remove("dark");
          document.body.classList.remove("dark");
          if (className) {
            document.documentElement.classList.add(className);
            document.body.classList.add(className);
          }
        }, theme.className);
        await page.waitForSelector(
          '[data-slot="button"], [data-slot="switch"], [data-slot="badge"], [data-slot="input"]',
          { timeout: 10000 }
        );
        await page.waitForTimeout(300);
        const filePath = path.join(outputRoot, `${theme.name}-${story.name}.png`);
        await page.screenshot({ path: filePath, fullPage: true });
        console.log("Captured", filePath);
      }
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  let playwright;
  try {
    playwright = resolvePlaywright();
  } catch {
    throw new Error(
      "Playwright is not installed. Run: pnpm --filter @atlas/web exec playwright install chromium"
    );
  }

  const { staticDir } = await ensureStorybook();
  const server = await startStaticServer(staticDir);
  await mkdir(outputRoot, { recursive: true });

  try {
    await captureScreenshots(server, playwright);
  } finally {
    await server.close();
  }

  console.log(`\nScreenshots saved to ${outputRoot}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
