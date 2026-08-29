#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_REPO_ROOT, loadPolicy } from "./security-audit-policy.mjs";

const scriptPath = fileURLToPath(import.meta.url);

function buildSyntheticGithubToken() {
  const prefix = ["ghp", "_"].join("");
  const body = ["1a2b3c4d5e6f7a8b9c0d", "e1f2a3b4c5d6e7f8"].join("");
  return `${prefix}${body}`;
}

export function runGitleaksDetect({
  sourceDir,
  repoRoot = DEFAULT_REPO_ROOT,
  network = "none",
} = {}) {
  const policy = loadPolicy(repoRoot);
  const image = `${policy.gitleaks.image}@${policy.gitleaks.digest}`;
  const result = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      `--network=${network}`,
      "-v",
      `${sourceDir}:/repo:ro`,
      "-w",
      "/repo",
      image,
      "detect",
      "--no-git",
      "--source=/repo",
      "--redact",
      "--verbose",
      "--exit-code",
      "1",
    ],
    { encoding: "utf8" },
  );

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error,
    image,
    version: policy.gitleaks.version,
  };
}

export function runSyntheticSecretFixture(repoRoot = DEFAULT_REPO_ROOT) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "atlas-gitleaks-fixture-"));
  try {
    writeFileSync(path.join(directory, "secret.txt"), `${buildSyntheticGithubToken()}\n`);
    return runGitleaksDetect({ sourceDir: directory, repoRoot });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function main() {
  const result = runSyntheticSecretFixture();
  if (result.error) {
    process.stderr.write(`Gitleaks fixture failed to start: ${result.error.message}\n`);
    process.exit(1);
  }
  if (result.status === 0) {
    process.stderr.write("Gitleaks fixture was not detected (scanner returned 0)\n");
    process.exit(1);
  }
  process.stdout.write(
    `✓ Gitleaks ${result.version} detected the synthetic fixture (exit ${result.status})\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main();
}
