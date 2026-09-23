import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { PUBLIC_CLI_PACKAGE_NAME } from "../atlas-workspaces.mjs";
import { withCliPackageBuildLock } from "../lib/cli-package-build-lock.mjs";
import { verifyNpmPublishDryRun } from "../lib/npm-publish-dry-run.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const cliRoot = path.join(repoRoot, "packages", "cli");
const turboConfig = JSON.parse(readFileSync(path.join(repoRoot, "turbo.json"), "utf8"));

const PUBLISH_BUILD_OUTPUTS = ["LICENSE", "THIRD_PARTY_NOTICES.md"];

function runTurboBuild({ force = false } = {}) {
  const args = ["turbo", "build", "--filter", PUBLIC_CLI_PACKAGE_NAME];
  if (force) {
    args.push("--force");
  }
  execSync(`pnpm ${args.join(" ")}`, {
    cwd: repoRoot,
    stdio: "pipe",
    env: process.env,
  });
}

function assertCliPublishArtifactsPresent() {
  for (const name of ["dist/cli.js", "assets/bootstrap/manifest.json", ...PUBLISH_BUILD_OUTPUTS]) {
    assert.equal(existsSync(path.join(cliRoot, name)), true, `expected ${name} after CLI build`);
  }
}

describe("CLI Turbo build cache restores npm-packaged legal files", () => {
  it("declares LICENSE and THIRD_PARTY_NOTICES.md as build task outputs", () => {
    const outputs = turboConfig.tasks?.build?.outputs ?? [];
    for (const required of PUBLISH_BUILD_OUTPUTS) {
      assert.equal(outputs.includes(required), true, `turbo build.outputs must include ${required}`);
    }
  });

  it("restores legal files on a warm Turbo cache hit after outputs are removed", () => {
    withCliPackageBuildLock(() => {
      runTurboBuild({ force: true });
      assertCliPublishArtifactsPresent();

      // Simulate a clean checkout that still hits Turbo's build cache: dist/assets restore
      // from cache, but gitignored legal files do not exist until outputs declare them.
      rmSync(path.join(cliRoot, "LICENSE"), { force: true });
      rmSync(path.join(cliRoot, "THIRD_PARTY_NOTICES.md"), { force: true });
      assert.equal(existsSync(path.join(cliRoot, "dist/cli.js")), true);

      runTurboBuild();
      assertCliPublishArtifactsPresent();
      verifyNpmPublishDryRun({ packageRoot: cliRoot });
    });
  });
});
