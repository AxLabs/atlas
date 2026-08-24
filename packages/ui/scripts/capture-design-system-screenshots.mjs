#!/usr/bin/env node
/**
 * Captures Design System/Atlas Storybook screenshots for PR review.
 * Usage: node scripts/capture-design-system-screenshots.mjs [outputDir]
 *
 * Requires Storybook static build at packages/ui/storybook-static
 * or a running dev server at http://localhost:6006.
 */

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
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
    await import("node:fs/promises").then((fs) => fs.access(filePath));
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

async function ensureStorybook() {
  const staticDir = path.join(packageRoot, "storybook-static");
  if (!(await fileExists(path.join(staticDir, "index.html")))) {
    throw new Error("Missing storybook-static build. Run pnpm build-storybook first.");
  }

  return { staticDir };
}

async function startStaticServer(staticDir) {
  const port = 6011;
  const server = await import("node:http").then((http) =>
    http.createServer((request, response) => {
      import("node:fs")
        .then((fs) => fs.promises)
        .then(async (fs) => {
          const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
          const relativePath = requestPath === "/" ? "/index.html" : requestPath;
          const filePath = path.join(staticDir, relativePath);

          try {
            const data = await fs.readFile(filePath);
            const ext = path.extname(filePath);
            const contentType =
              ext === ".html"
                ? "text/html"
                : ext === ".js"
                  ? "application/javascript"
                  : ext === ".css"
                    ? "text/css"
                    : ext === ".json"
                      ? "application/json"
                      : ext === ".svg"
                        ? "image/svg+xml"
                        : "application/octet-stream";
            response.writeHead(200, { "Content-Type": contentType });
            response.end(data);
          } catch {
            response.writeHead(404);
            response.end("Not found");
          }
        });
    })
  );

  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${port}/iframe.html`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

async function main() {
  const playwrightCli = "pnpm";
  const playwrightArgs = ["dlx", "playwright@1.61.0"];

  const staticDir = path.join(packageRoot, "storybook-static");
  if (!(await fileExists(path.join(staticDir, "index.html")))) {
    console.log("Building Storybook static site…");
    await run("pnpm", ["build-storybook"], { cwd: packageRoot });
  }

  const { staticDir: builtDir } = await ensureStorybook();
  const server = await startStaticServer(builtDir);
  await mkdir(outputRoot, { recursive: true });

  const scriptBody = `
const { chromium } = require('playwright');

const stories = ${JSON.stringify(stories)};
const themes = ${JSON.stringify(themes)};
const baseUrl = ${JSON.stringify(server.url)};
const outputRoot = ${JSON.stringify(outputRoot)};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  for (const theme of themes) {
    for (const story of stories) {
      const target = \`\${baseUrl}?id=\${story.id}&viewMode=story\`;
      await page.goto(target, { waitUntil: 'networkidle' });
      await page.evaluate((className) => {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
        if (className) {
          document.documentElement.classList.add(className);
          document.body.classList.add(className);
        }
      }, theme.className);
      await page.waitForSelector('[data-slot="button"], [data-slot="switch"], [data-slot="badge"], [data-slot="input"]', {
        timeout: 10000,
      });
      await page.waitForTimeout(300);
      const filePath = require('path').join(outputRoot, \`\${theme.name}-\${story.name}.png\`);
      await page.screenshot({ path: filePath, fullPage: true });
      console.log('Captured', filePath);
    }
  }

  await browser.close();
})();
`;

  const runnerPath = path.join(packageRoot, ".tmp-capture-screenshots.cjs");
  await import("node:fs/promises").then((fs) => fs.writeFile(runnerPath, scriptBody));

  try {
    await run(playwrightCli, [...playwrightArgs, "install", "chromium"], { cwd: packageRoot });
    await run("node", [runnerPath], { cwd: packageRoot });
  } finally {
    await import("node:fs/promises").then((fs) => fs.unlink(runnerPath).catch(() => {}));
    await server.close();
  }

  console.log(`\nScreenshots saved to ${outputRoot}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
