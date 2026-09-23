import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const lockPath = path.join(repoRoot, "packages", "cli", ".build-lock", "active");

function pause(ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    // busy-wait: keep lock acquisition synchronous for execSync-based tests
  }
}

/**
 * Serialize mutations to packages/cli build outputs (dist/, assets/, legal files).
 * Required when multiple script tests invoke `turbo build` for @blitzcraftlabs/atlas in parallel.
 */
export function withCliPackageBuildLock(run) {
  mkdirSync(path.dirname(lockPath), { recursive: true });

  while (true) {
    try {
      mkdirSync(lockPath);
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw error;
      }
      pause(50);
    }
  }

  try {
    return run();
  } finally {
    rmSync(lockPath, { recursive: true, force: true });
  }
}
