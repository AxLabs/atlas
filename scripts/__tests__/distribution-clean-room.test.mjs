import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  auditGeneratedWorkspace,
  collectRepoPathLeaks,
  collectWorkspaceResolutionIssues,
  filterPathForCleanRoom,
  formatStageFailure,
  parseJsonEnvelope,
  sanitizeCleanRoomEnv,
  valueIncludesRepo,
} from "../lib/distribution-clean-room.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function writeManifest(root, relativePath, manifest) {
  const filePath = path.join(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`);
}

describe("distribution clean-room helpers", () => {
  it("removes NODE_PATH, repo bin PATH entries, and Atlas-only env channels", () => {
    const env = sanitizeCleanRoomEnv({
      repoRoot,
      cwd: "/tmp/atlas-clean-room-test",
      sourceEnv: {
        PATH: `/usr/bin:${path.join(repoRoot, "node_modules", ".bin")}:/usr/local/bin`,
        NODE_PATH: path.join(repoRoot, "node_modules"),
        ATLAS_REFERENCE_MODE: "true",
        SKIP_ENV_VALIDATION: "true",
        ATLAS_CI_RUNNER_PROFILE: "github-hosted",
        INIT_CWD: repoRoot,
        PWD: repoRoot,
        HOME: "/home/atlas",
        PNPM_STORE_DIR: "/tmp/pnpm-store",
        CI: "true",
        npm_package_name: "@atlas/monorepo",
      },
    });

    assert.equal(env.NODE_PATH, undefined);
    assert.equal(env.ATLAS_REFERENCE_MODE, undefined);
    assert.equal(env.SKIP_ENV_VALIDATION, undefined);
    assert.equal(env.ATLAS_CI_RUNNER_PROFILE, undefined);
    assert.equal(env.npm_package_name, undefined);
    assert.equal(env.INIT_CWD, "/tmp/atlas-clean-room-test");
    assert.equal(env.PWD, "/tmp/atlas-clean-room-test");
    assert.equal(env.HOME, "/home/atlas");
    assert.equal(env.PNPM_STORE_DIR, "/tmp/pnpm-store");
    assert.equal(env.CI, "true");
    assert.equal(env.PATH?.includes(path.join(repoRoot, "node_modules", ".bin")), false);
    assert.match(env.PATH ?? "", /\/usr\/bin/);
    assert.match(env.PATH ?? "", /\/usr\/local\/bin/);
  });

  it("filters PATH entries that resolve inside the Atlas checkout", () => {
    const filtered = filterPathForCleanRoom(
      ["/usr/bin", path.join(repoRoot, "packages", "cli", "dist"), "/opt/node/bin"].join(
        path.delimiter
      ),
      repoRoot
    );
    assert.equal(filtered.includes(repoRoot), false);
    assert.match(filtered, /\/usr\/bin/);
    assert.match(filtered, /\/opt\/node\/bin/);
  });

  it("detects workspace protocol and unpublished Atlas package leaks across all manifests", () => {
    const generatedRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-clean-room-audit-"));
    writeManifest(generatedRoot, "package.json", {
      name: "test-app",
      version: "0.1.0",
      dependencies: {
        "@atlas/cli": "workspace:*",
      },
    });
    writeManifest(generatedRoot, "apps/web/package.json", {
      name: "@atlas/web",
      dependencies: {
        "@atlas/ui": "workspace:*",
        "@atlas/project": "^0.3.0",
      },
    });
    writeManifest(generatedRoot, "packages/ui/package.json", { name: "@atlas/ui" });
    writeManifest(generatedRoot, "packages/consent/package.json", { name: "@atlas/consent" });
    writeManifest(generatedRoot, "packages/config/package.json", { name: "@atlas/config" });

    const issues = auditGeneratedWorkspace(generatedRoot);
    assert.ok(issues.some((issue) => issue.includes("@atlas/cli")));
    assert.ok(issues.some((issue) => issue.includes("@atlas/project")));
    assert.equal(
      issues.some((issue) => issue.includes("@atlas/ui") && issue.includes("workspace:*")),
      false
    );
  });

  it("resolves workspace protocol dependencies from the consuming package, not the repo root", () => {
    const generatedRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-clean-room-resolve-"));
    writeManifest(generatedRoot, "package.json", { name: "test-app", version: "0.1.0" });
    writeManifest(generatedRoot, "apps/web/package.json", {
      name: "@atlas/web",
      dependencies: { "@atlas/ui": "workspace:*" },
    });
    writeManifest(generatedRoot, "packages/ui/package.json", { name: "@atlas/ui" });
    writeManifest(generatedRoot, "packages/consent/package.json", { name: "@atlas/consent" });
    writeManifest(generatedRoot, "packages/config/package.json", { name: "@atlas/config" });

    const missing = collectWorkspaceResolutionIssues(generatedRoot);
    assert.ok(missing.some((issue) => issue.includes("@atlas/ui")));

    mkdirSync(path.join(generatedRoot, "apps/web/node_modules/@atlas"), { recursive: true });
    symlinkSync(
      path.join(generatedRoot, "packages/ui"),
      path.join(generatedRoot, "apps/web/node_modules/@atlas/ui")
    );
    assert.deepEqual(collectWorkspaceResolutionIssues(generatedRoot), []);
  });

  it("accepts a generated workspace whose Atlas packages stay inside the project", () => {
    const generatedRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-clean-room-ok-"));
    writeManifest(generatedRoot, "package.json", { name: "test-app", version: "0.1.0" });
    writeManifest(generatedRoot, "apps/web/package.json", {
      name: "@atlas/web",
      dependencies: { "@atlas/ui": "workspace:*", "@atlas/consent": "workspace:*" },
      devDependencies: { "@atlas/config": "workspace:*" },
    });
    writeManifest(generatedRoot, "packages/ui/package.json", {
      name: "@atlas/ui",
      devDependencies: { "@atlas/config": "workspace:*" },
    });
    writeManifest(generatedRoot, "packages/consent/package.json", {
      name: "@atlas/consent",
      devDependencies: { "@atlas/config": "workspace:*" },
    });
    writeManifest(generatedRoot, "packages/config/package.json", { name: "@atlas/config" });

    assert.deepEqual(auditGeneratedWorkspace(generatedRoot), []);
  });

  it("formats stage failures with command, cwd, status, stdout, and stderr", () => {
    const message = formatStageFailure({
      stage: "build",
      command: "/usr/bin/pnpm",
      args: ["build"],
      cwd: "/tmp/atlas-clean-room-x/test-app",
      status: 1,
      stdout: "building",
      stderr: "missing dep",
    });
    assert.match(message, /\[clean-room\] FAILED build/);
    assert.match(message, /command: \/usr\/bin\/pnpm build/);
    assert.match(message, /cwd: \/tmp\/atlas-clean-room-x\/test-app/);
    assert.match(message, /exit status: 1/);
    assert.match(message, /stdout:\nbuilding/);
    assert.match(message, /stderr:\nmissing dep/);
  });

  it("parses CLI JSON envelopes and reports repo path leaks", () => {
    const payload = parseJsonEnvelope(
      JSON.stringify({
        ok: true,
        command: "context",
        result: { atlasVersion: "0.3.0", project: { root: "." } },
      }),
      "atlas context --json"
    );
    assert.equal(payload.ok, true);
    assert.deepEqual(collectRepoPathLeaks(payload, repoRoot), []);
    assert.ok(collectRepoPathLeaks({ path: path.join(repoRoot, "apps/web") }, repoRoot).length > 0);
    assert.equal(valueIncludesRepo(path.join(repoRoot, "packages/cli"), repoRoot), true);
  });

  it("keeps the verifier as a repository-level Node script rather than a Jest e2e", () => {
    const verifier = readFileSync(
      path.join(repoRoot, "scripts", "verify-distribution-clean-room.mjs"),
      "utf8"
    );
    const packE2e = readFileSync(
      path.join(repoRoot, "packages", "cli", "src", "__tests__", "pack.e2e.test.ts"),
      "utf8"
    );
    assert.match(verifier, /\["install"\]/);
    assert.match(verifier, /\["build"\]/);
    assert.match(verifier, /CLEAN_ROOM_STAGES\.installConsumer/);
    assert.match(verifier, /CLEAN_ROOM_STAGES\.build/);
    assert.doesNotMatch(packE2e, /\["install"\]/);
    assert.doesNotMatch(packE2e, /\["build"\]/);
  });
});
