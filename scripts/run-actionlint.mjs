#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { arch, platform } from "node:os";
import { fileURLToPath } from "node:url";

import { DEFAULT_REPO_ROOT } from "./security-audit-policy.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const ACTIONLINT_VERSION = "1.7.7";

function actionlintAssetName() {
  const system = platform();
  const cpu = arch();
  if (system === "linux" && (cpu === "x64" || cpu === "amd64")) {
    return `actionlint_${ACTIONLINT_VERSION}_linux_amd64.tar.gz`;
  }
  if (system === "darwin" && cpu === "arm64") {
    return `actionlint_${ACTIONLINT_VERSION}_darwin_arm64.tar.gz`;
  }
  if (system === "darwin" && (cpu === "x64" || cpu === "amd64")) {
    return `actionlint_${ACTIONLINT_VERSION}_darwin_amd64.tar.gz`;
  }
  throw new Error(`Unsupported platform for bundled actionlint: ${system} ${cpu}`);
}

function ensureBundledActionlint(root) {
  const cacheDir = path.join(root, "node_modules", ".cache", "actionlint", ACTIONLINT_VERSION);
  const binaryPath = path.join(cacheDir, "actionlint");
  if (existsSync(binaryPath)) {
    return binaryPath;
  }

  mkdirSync(cacheDir, { recursive: true });
  const asset = actionlintAssetName();
  const archivePath = path.join(cacheDir, asset);
  const url = `https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/${asset}`;

  execFileSync("curl", ["-fsSL", "-o", archivePath, url], { stdio: "inherit" });
  execFileSync("tar", ["-xzf", archivePath, "-C", cacheDir, "actionlint"], { stdio: "inherit" });

  return binaryPath;
}

function resolveActionlintBinary(root) {
  try {
    execFileSync("actionlint", ["-version"], { stdio: "pipe" });
    return "actionlint";
  } catch {
    return ensureBundledActionlint(root);
  }
}

export function runActionlint(root = DEFAULT_REPO_ROOT) {
  const binary = resolveActionlintBinary(root);
  const workflowDir = path.join(root, ".github", "workflows");
  const targets = readdirSync(workflowDir)
    .filter((name) => /\.ya?ml$/i.test(name))
    .map((name) => path.join(workflowDir, name));

  const configFile = path.join(root, "actionlint.yaml");
  const args = existsSync(configFile) ? ["-config-file", configFile, ...targets] : targets;

  try {
    execFileSync(binary, args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return [];
  } catch (error) {
    const stdout = error.stdout?.toString?.() ?? "";
    const stderr = error.stderr?.toString?.() ?? "";
    const combined = `${stdout}\n${stderr}`.trim();
    if (!combined) {
      return [`actionlint failed with exit code ${error.status ?? 1}`];
    }
    return combined
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }
}

function main() {
  const errors = runActionlint();
  if (errors.length > 0) {
    process.stderr.write("actionlint failed:\n");
    for (const error of errors) {
      process.stderr.write(`  ✗ ${error}\n`);
    }
    process.exit(1);
  }
  process.stdout.write("✓ actionlint passed\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main();
}
