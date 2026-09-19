import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";

import {
  classifyCiChanges,
  isAppImpactingPath,
  isDistributionCriticalPath,
  REPO_ROOT,
} from "../ci-change-paths.mjs";

const cli = path.join(REPO_ROOT, "scripts", "ci-change-paths.mjs");

function runCli(args) {
  try {
    const stdout = execFileSync(process.execPath, [cli, ...args], {
      encoding: "utf8",
      cwd: REPO_ROOT,
    });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return {
      status: error.status ?? 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    };
  }
}

describe("CI change-path classification", () => {
  it("runs application CI but not clean-room verify for ordinary web source", () => {
    const result = classifyCiChanges(["apps/web/src/app/page.tsx"]);
    assert.equal(result.app, true);
    assert.equal(result.distribution, false);
    assert.equal(isAppImpactingPath("apps/web/src/app/page.tsx"), true);
    assert.equal(isDistributionCriticalPath("apps/web/src/app/page.tsx"), false);
  });

  it("runs application CI but not clean-room verify for ordinary UI source", () => {
    const result = classifyCiChanges(["packages/ui/src/components/ui/button.tsx"]);
    assert.equal(result.app, true);
    assert.equal(result.distribution, false);
  });

  it("fails closed for CLI, templates, workspace metadata, and publish scripts", () => {
    const files = [
      "packages/cli/src/cli.ts",
      "packages/project/src/index.ts",
      "templates/app-infrastructure.manifest.json",
      "packages/cli/release-assets/production/1.0.0/release.snapshot.json",
      "package.json",
      "pnpm-workspace.yaml",
      "pnpm-lock.yaml",
      "apps/web/package.json",
      "apps/web/next.config.js",
      "scripts/verify-distribution-clean-room.mjs",
      "scripts/ci-change-paths.mjs",
      ".changeset/cool-fox.md",
      ".github/workflows/release.yml",
    ];

    for (const file of files) {
      assert.equal(isDistributionCriticalPath(file), true, file);
    }

    const result = classifyCiChanges(files);
    assert.equal(result.distribution, true);
    assert.equal(result.app, true);
  });

  it("does not treat Storybook or reference-only files as distribution-critical", () => {
    const result = classifyCiChanges([
      "packages/ui/.storybook/main.ts",
      "packages/ui/visual-tests/button.spec.ts",
      "apps/reference/src/app/page.tsx",
      "docs/how-we-build/ci.md",
    ]);
    assert.equal(result.distribution, false);
  });

  it("CLI reports GitHub output assignments", () => {
    const result = runCli(["--files", "apps/web/src/app/page.tsx"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /app=true/);
    assert.match(result.stdout, /distribution=false/);
  });

  it("push events fail closed to full distribution assurance", () => {
    const result = runCli(["--event", "push", "--files", "README.md"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "app=true\ndistribution=true\n");
  });
});
