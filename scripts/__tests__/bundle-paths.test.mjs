import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  BUNDLE_BOOTSTRAP_PATHS,
  classifyBundleChanges,
  isBundleImpactingPath,
  REPO_ROOT,
} from "../bundle-paths.mjs";

const cli = path.join(REPO_ROOT, "scripts", "bundle-paths.mjs");
const workflowPath = path.join(REPO_ROOT, ".github", "workflows", "perf-bundle.yml");
const suiteActionPath = path.join(
  REPO_ROOT,
  ".github",
  "actions",
  "run-bundle-analysis-suite",
  "action.yml"
);

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

describe("Bundle Analysis path classification", () => {
  it("runs for application, UI, and lockfile changes", () => {
    assert.equal(isBundleImpactingPath("apps/web/src/app/page.tsx"), true);
    assert.equal(isBundleImpactingPath("packages/ui/src/components/ui/button.tsx"), true);
    assert.equal(isBundleImpactingPath("pnpm-lock.yaml"), true);
    assert.equal(classifyBundleChanges(["apps/web/next.config.js"]).bundle, true);
  });

  it("does not run for generated production snapshots or changelog/changeset version PRs", () => {
    assert.equal(
      isBundleImpactingPath(
        "packages/cli/release-assets/production/1.0.0/apps/web/src/app/page.tsx"
      ),
      false
    );
    assert.equal(
      classifyBundleChanges([
        ".changeset/cool-fox.md",
        "CHANGELOG.md",
        "apps/web/package.json",
        "packages/ui/package.json",
        "packages/cli/release-assets/production/1.0.0/release.snapshot.json",
      ]).bundle,
      false
    );
  });

  it("does not run for CLI-only or docs-only changes", () => {
    assert.equal(classifyBundleChanges(["packages/cli/src/cli.ts"]).bundle, false);
    assert.equal(classifyBundleChanges(["docs/how-we-build/ci.md"]).bundle, false);
  });

  it("classifies every bootstrap path as bundle-impacting", () => {
    for (const bootstrapPath of BUNDLE_BOOTSTRAP_PATHS) {
      assert.equal(isBundleImpactingPath(bootstrapPath), true, bootstrapPath);
    }
  });

  it("CLI reports true for web source and false for a version-only file list", () => {
    const web = runCli(["--files", "apps/web/src/app/page.tsx"]);
    assert.equal(web.status, 0, web.stderr);
    assert.equal(web.stdout.trim(), "true");

    const version = runCli([
      "--files",
      ".changeset/cool-fox.md",
      "CHANGELOG.md",
      "packages/ui/package.json",
    ]);
    assert.equal(version.status, 0, version.stderr);
    assert.equal(version.stdout.trim(), "false");
  });

  it("requires the Bundle Analysis workflow to stay on GitHub-hosted Ubuntu", () => {
    const workflow = readFileSync(workflowPath, "utf8");
    const suiteAction = readFileSync(suiteActionPath, "utf8");
    assert.match(`${workflow}\n${suiteAction}`, /node scripts\/bundle-paths\.mjs --git-diff/);
    assert.doesNotMatch(workflow, /trusted-self-hosted\.yml/);
    assert.match(workflow, /runs-on: ubuntu-latest/);
  });
});
