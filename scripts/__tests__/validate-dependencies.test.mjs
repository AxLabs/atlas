import { execSync } from "node:child_process";
import { test } from "node:test";

test("validate-dependencies passes on current manifests", () => {
  execSync("node scripts/validate-dependencies.mjs", {
    cwd: process.cwd(),
    stdio: "pipe",
  });
});
