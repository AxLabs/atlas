#!/usr/bin/env node
/**
 * Compare (or explicitly recapture) Chromium visual baselines in the canonical
 * Playwright image: mcr.microsoft.com/playwright:v<playwright-version>-noble.
 *
 * Host Chromium is not a supported comparison environment. This script never
 * updates snapshots unless `--update` is passed.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  let update = false;
  for (const arg of argv) {
    if (arg === "--update") {
      update = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "Usage: node scripts/run-visual-in-playwright-docker.mjs [--update]\n" +
          "  (default) compare shipped baselines in the Playwright Docker image\n" +
          "  --update   recapture baselines in that same image; review PNGs before committing\n"
      );
      process.exit(0);
    }
    fail(`Unknown argument: ${arg}. Use --update to recapture baselines after visual review.`);
  }
  return { update };
}

function findWorkspaceRoot(start) {
  let current = start;
  while (true) {
    if (existsSync(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      fail("Unable to find pnpm-workspace.yaml above packages/ui.");
    }
    current = parent;
  }
}

function playwrightVersion() {
  const manifest = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  const version = manifest.devDependencies?.["@playwright/test"];
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+/.test(version)) {
    fail("packages/ui/package.json is missing a pinned @playwright/test version.");
  }
  return version.replace(/^[^\d]*/, "");
}

const { update } = parseArgs(process.argv.slice(2));
const workspaceRoot = findWorkspaceRoot(packageRoot);
const staticDir = path.join(packageRoot, "storybook-static");
if (!existsSync(staticDir)) {
  fail("packages/ui/storybook-static is missing. Run `pnpm --filter @atlas/ui build-storybook` first.");
}

const dockerCheck = spawnSync("docker", ["info"], { stdio: "ignore" });
if (dockerCheck.status !== 0) {
  fail(
    "Docker is required for visual comparisons. Run this command on a machine that can start " +
      "mcr.microsoft.com/playwright:v<playwright-version>-noble. Do not compare or update " +
      "snapshots with host Chromium."
  );
}

const version = playwrightVersion();
const image = `mcr.microsoft.com/playwright:v${version}-noble`;
const uid = typeof process.getuid === "function" ? String(process.getuid()) : "0";
const gid = typeof process.getgid === "function" ? String(process.getgid()) : "0";
const innerCommand = update ? "test:visual:update" : "test:visual";

process.stdout.write(
  `${update ? "Recapturing" : "Comparing"} visual baselines in ${image}\n` +
    (update ? "Review every PNG before committing. This does not commit or approve changes.\n" : "")
);

const result = spawnSync(
  "docker",
  [
    "run",
    "--rm",
    "--user",
    `${uid}:${gid}`,
    "--ipc=host",
    "--network",
    "host",
    "-v",
    `${workspaceRoot}:${workspaceRoot}`,
    "-w",
    workspaceRoot,
    "-e",
    "CI=true",
    "-e",
    "HOME=/tmp/pw-home",
    image,
    "bash",
    "-lc",
    `mkdir -p "$HOME/bin" && corepack enable --install-directory "$HOME/bin" pnpm && export PATH="$HOME/bin:$PATH" && pnpm --filter @atlas/ui ${innerCommand}`,
  ],
  { stdio: "inherit" }
);

if (result.error) {
  fail(result.error.message);
}

process.exit(result.status === null ? 1 : result.status);
