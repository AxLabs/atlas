#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const staticDir = path.join(packageRoot, "storybook-static");
const host = process.env.STORYBOOK_STATIC_HOST ?? "127.0.0.1";
const port = Number(process.env.STORYBOOK_STATIC_PORT ?? 6006);
const baseUrl = `http://${host}:${port}`;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: packageRoot,
      stdio: "inherit",
      env: { ...process.env, ...options.env },
      shell: false,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} terminated by ${signal}`));
        return;
      }
      resolve(code ?? 1);
    });
  });
}

async function waitForServer(timeoutMs = 60_000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const request = http.get(`${baseUrl}/iframe.html`, (response) => {
          response.resume();
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 500) {
            resolve();
            return;
          }
          reject(new Error(`Unexpected status ${response.statusCode}`));
        });
        request.on("error", reject);
        request.setTimeout(2_000, () => {
          request.destroy(new Error("timeout"));
        });
      });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw new Error(`Timed out waiting for Storybook static server at ${baseUrl}`);
}

async function main() {
  if (!existsSync(staticDir)) {
    console.error(
      `Missing ${staticDir}. Run "pnpm --filter @atlas/ui build-storybook" before test:storybook.`
    );
    process.exit(1);
  }

  const server = spawn(process.execPath, [path.join(__dirname, "serve-storybook-static.mjs")], {
    cwd: packageRoot,
    stdio: ["ignore", "pipe", "inherit"],
    env: {
      ...process.env,
      STORYBOOK_STATIC_HOST: host,
      STORYBOOK_STATIC_PORT: String(port),
    },
  });

  let serverExited = false;
  server.on("exit", () => {
    serverExited = true;
  });

  const shutdownServer = async () => {
    if (serverExited || server.killed) {
      return;
    }

    try {
      server.kill("SIGTERM");
      await new Promise((resolve) => server.once("exit", resolve));
    } catch {
      // The static server may already have exited in constrained environments.
    }
  };

  process.on("SIGINT", async () => {
    await shutdownServer();
    process.exit(130);
  });
  process.on("SIGTERM", async () => {
    await shutdownServer();
    process.exit(143);
  });

  try {
    await waitForServer();
    const exitCode = await run(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      ["exec", "test-storybook", "--url", baseUrl, "--maxWorkers", "2"],
      {
        env: {
          STORYBOOK_TEST_RUNNER_URL: baseUrl,
        },
      }
    );
    await shutdownServer();
    process.exit(exitCode);
  } catch (error) {
    console.error(error);
    await shutdownServer();
    process.exit(1);
  }
}

void main();
