import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { PUBLIC_CLI_PACKAGE_NAME, PUBLIC_CLI_WORKSPACE_BUILD_ARGS } from "../atlas-workspaces.mjs";
import {
  ATLAS_PROJECT_PACKAGE_NAME,
  atlasProjectDistIndex,
  atlasProjectTypesEntry,
  ensureAtlasProjectBuilt,
} from "../../packages/cli/scripts/ensure-atlas-project-built.mjs";

// Mutates shared `packages/project/dist` and `tsconfig.build.tsbuildinfo`.
// scripts/lib/script-test-schedule.mjs runs this file after the parallel batch.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const projectDir = path.join(repoRoot, "packages", "project");
const cliPackageJsonPath = path.join(repoRoot, "packages", "cli", "package.json");
const tscBin = createRequire(cliPackageJsonPath).resolve("typescript/bin/tsc");

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function runProbeTypecheck(workDir) {
  return spawnSync(process.execPath, [tscBin, "-p", "tsconfig.json", "--pretty", "false"], {
    cwd: workDir,
    encoding: "utf8",
    env: process.env,
  });
}

function createProjectResolveProbe() {
  const workDir = path.join(os.tmpdir(), `atlas-project-resolve-${process.pid}-${Date.now()}`);
  mkdirSync(path.join(workDir, "node_modules", "@atlas"), { recursive: true });
  symlinkSync(projectDir, path.join(workDir, "node_modules", "@atlas", "project"));
  writeFileSync(
    path.join(workDir, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          module: "CommonJS",
          moduleResolution: "Node",
          noEmit: true,
          skipLibCheck: true,
          types: [],
          noUncheckedSideEffectImports: true,
        },
        include: ["probe.ts"],
      },
      null,
      2
    )}\n`
  );
  writeFileSync(
    path.join(workDir, "probe.ts"),
    `import { LATEST_SCHEMA_VERSION } from "${ATLAS_PROJECT_PACKAGE_NAME}";\nexport const atlasSchema = LATEST_SCHEMA_VERSION;\n`
  );
  return workDir;
}

describe("CLI workspace compile dependency preparation", () => {
  it("points @atlas/project types and default export at built dist, not source", () => {
    const projectManifest = readJson("packages/project/package.json");
    assert.equal(projectManifest.name, ATLAS_PROJECT_PACKAGE_NAME);
    assert.equal(projectManifest.types, "./dist/index.d.ts");
    assert.equal(projectManifest.exports["."].types, "./dist/index.d.ts");
    assert.equal(projectManifest.exports["."].default, "./dist/index.js");

    const cliManifest = readJson("packages/cli/package.json");
    assert.equal(cliManifest.devDependencies[ATLAS_PROJECT_PACKAGE_NAME], "workspace:*");
    assert.match(
      cliManifest.scripts.build,
      /node scripts\/ensure-atlas-project-built\.mjs && rm -rf dist assets && tsc -p tsconfig\.build\.json/
    );
  });

  it("packs, publishes, and runs doctor with Turbo ^build rather than a CLI-only filter", () => {
    assert.deepEqual(PUBLIC_CLI_WORKSPACE_BUILD_ARGS, [
      "turbo",
      "build",
      "--filter",
      PUBLIC_CLI_PACKAGE_NAME,
    ]);

    const publication = readFileSync(
      path.join(repoRoot, "scripts", "lib", "npm-publication.mjs"),
      "utf8"
    );
    const snapshot = readFileSync(
      path.join(repoRoot, "packages", "cli", "scripts", "generate-production-release-snapshot.mjs"),
      "utf8"
    );
    const cliPackageJson = readFileSync(cliPackageJsonPath, "utf8");

    assert.match(publication, /PUBLIC_CLI_WORKSPACE_BUILD_ARGS/);
    assert.doesNotMatch(publication, /\["turbo", "build", "--filter", PUBLIC_CLI_PACKAGE_NAME\]/);
    assert.match(snapshot, /ensureAtlasProjectBuilt/);
    assert.match(cliPackageJson, /ensure-atlas-project-built\.mjs/);
  });

  it("fails CLI-style TypeScript resolution when @atlas/project dist is missing, then recovers after prep", () => {
    assert.equal(existsSync(tscBin), true, "CLI workspace must have a local typescript binary");

    const distDir = path.join(projectDir, "dist");
    const hiddenDir = path.join(projectDir, `.dist-hidden-${process.pid}`);
    const tsbuildinfo = path.join(projectDir, "tsconfig.build.tsbuildinfo");
    const hiddenTsbuildinfo = `${tsbuildinfo}.hidden-${process.pid}`;
    const probeDir = createProjectResolveProbe();
    const hadDist = existsSync(distDir);
    const hadTsbuildinfo = existsSync(tsbuildinfo);

    rmSync(hiddenDir, { recursive: true, force: true });
    if (hadDist) {
      renameSync(distDir, hiddenDir);
    }
    if (hadTsbuildinfo) {
      renameSync(tsbuildinfo, hiddenTsbuildinfo);
    }

    try {
      const missing = runProbeTypecheck(probeDir);
      assert.notEqual(missing.status, 0);
      assert.match(missing.stdout + missing.stderr, /TS2307: Cannot find module '@atlas\/project'/);

      ensureAtlasProjectBuilt({
        monorepoRoot: repoRoot,
        projectDir,
        stdio: "pipe",
      });
      assert.equal(existsSync(atlasProjectDistIndex(projectDir)), true);
      assert.equal(existsSync(atlasProjectTypesEntry(projectDir)), true);

      const recovered = runProbeTypecheck(probeDir);
      assert.equal(recovered.status, 0, recovered.stdout + recovered.stderr);
    } finally {
      rmSync(probeDir, { recursive: true, force: true });
      if (existsSync(hiddenDir)) {
        rmSync(distDir, { recursive: true, force: true });
        renameSync(hiddenDir, distDir);
      }
      if (existsSync(hiddenTsbuildinfo)) {
        rmSync(tsbuildinfo, { force: true });
        renameSync(hiddenTsbuildinfo, tsbuildinfo);
      }
    }
  });
});
