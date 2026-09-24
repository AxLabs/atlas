import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { ATLAS_WORKSPACE_PACKAGES } from "../atlas-workspaces.mjs";
import {
  consolidateAtlasRelease,
  generateCurrentProductionReleaseSnapshot,
} from "../consolidate-atlas-release.mjs";
import { generateProductionReleaseSnapshotFromTree } from "../../packages/cli/scripts/generate-production-release-snapshot.mjs";

// Invokes real `ensureAtlasProjectBuilt()` against shared `packages/project/dist`.
// scripts/lib/script-test-schedule.mjs runs this file after the parallel batch and
// before other isolated shared-output tests so it does not race them.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function writeMiniAtlasReleaseTree(root, version, syncedSourceBody) {
  writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "@atlas/monorepo", version, private: true }, null, 2)}\n`
  );
  writeFileSync(
    path.join(root, "atlas.config.json"),
    `${JSON.stringify({ schemaVersion: 1 }, null, 2)}\n`
  );
  mkdirSync(path.join(root, "templates"), { recursive: true });
  writeFileSync(
    path.join(root, "templates/app-infrastructure.manifest.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        canonicalApplication: "apps/web",
        consumerApplications: ["apps/reference"],
        syncedPaths: ["src/lib/api/errors.ts"],
        generatedPaths: ["src/lib/api/contracts/schema.ts"],
        independentPaths: {
          "apps/reference": {
            "src/lib/application/authz.ts": "Consumer-owned wiring",
          },
        },
        referenceOnlyPaths: [],
        starterOnlyPaths: [],
      },
      null,
      2
    )}\n`
  );

  for (const relative of [
    "packages/cli/package.json",
    "packages/ui/package.json",
    "packages/config/package.json",
    "packages/consent/package.json",
    "packages/project/package.json",
  ]) {
    const segment = relative.split("/")[1];
    const name =
      segment === "cli" ? "@blitzcraftlabs/atlas" : `@atlas/${segment}`;
    mkdirSync(path.join(root, path.dirname(relative)), { recursive: true });
    writeFileSync(
      path.join(root, relative),
      `${JSON.stringify({ name, version, private: name !== "@blitzcraftlabs/atlas" }, null, 2)}\n`
    );
  }

  mkdirSync(path.join(root, "apps/web/src/lib/api/contracts"), { recursive: true });
  mkdirSync(path.join(root, "apps/web/src/lib/application"), { recursive: true });
  mkdirSync(path.join(root, "openapi"), { recursive: true });
  writeFileSync(path.join(root, "apps/web/src/lib/api/errors.ts"), syncedSourceBody);
  writeFileSync(
    path.join(root, "apps/web/src/lib/api/contracts/schema.ts"),
    "export const schema = true;\n"
  );
  writeFileSync(
    path.join(root, "apps/web/src/lib/application/authz.ts"),
    "export const authz = true;\n"
  );
  writeFileSync(path.join(root, "openapi/openapi.json"), '{"openapi":"3.0.0","paths":{}}\n');
}

function writeConsolidateChangelogFixture(dir, version) {
  writeFileSync(
    path.join(dir, "CHANGELOG.md"),
    `# Changelog

## [Unreleased]

### Added

- Pending release work

## [0.1.0] - 2026-08-19

### Added

- Baseline

[Unreleased]: https://github.com/blitzcraftlabs/atlas/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/blitzcraftlabs/atlas/releases/tag/v0.1.0
`,
    "utf8"
  );

  for (const pkg of ATLAS_WORKSPACE_PACKAGES) {
    mkdirSync(path.join(dir, pkg.relativePath), { recursive: true });
    writeFileSync(
      path.join(dir, pkg.relativePath, "package.json"),
      JSON.stringify({ name: pkg.name, version, private: true })
    );
    writeFileSync(
      path.join(dir, pkg.relativePath, "CHANGELOG.md"),
      `## [${version}]\n\n### Patch Changes\n\n- Release consolidation snapshot refresh coverage for ${pkg.name}.\n`,
      "utf8"
    );
  }
}

function snapshotSyncedErrorsPath(outputDir) {
  return path.join(outputDir, "apps/web/src/lib/api/errors.ts");
}

function consolidateSnapshotSyncedErrorsPath(dir, version) {
  return snapshotSyncedErrorsPath(
    path.join(dir, "packages/cli/release-assets/production", version)
  );
}

describe("production snapshot generator default immutability", () => {
  it("skips regeneration when a snapshot already exists and replace is not set", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "atlas-snapshot-skip-"));
    const version = "0.8.1";
    const outputDir = path.join(root, "out", version);

    try {
      writeMiniAtlasReleaseTree(root, version, "export const errors = 'v1';\n");

      const first = await generateProductionReleaseSnapshotFromTree({
        repoRoot: root,
        outputDir,
        replace: true,
      });
      assert.equal(first.status, "generated");

      const second = await generateProductionReleaseSnapshotFromTree({
        repoRoot: root,
        outputDir,
      });
      assert.equal(second.status, "skipped");
      assert.equal(second.reason, "snapshot-exists");
      assert.match(readFileSync(snapshotSyncedErrorsPath(outputDir), "utf8"), /'v1'/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("replaces an existing snapshot when replace is true", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "atlas-snapshot-replace-"));
    const version = "0.8.2";
    const outputDir = path.join(root, "out", version);

    try {
      writeMiniAtlasReleaseTree(root, version, "export const errors = 'v1';\n");
      await generateProductionReleaseSnapshotFromTree({
        repoRoot: root,
        outputDir,
        replace: true,
      });

      writeFileSync(path.join(root, "apps/web/src/lib/api/errors.ts"), "export const errors = 'v2';\n");
      const replaced = await generateProductionReleaseSnapshotFromTree({
        repoRoot: root,
        outputDir,
        replace: true,
      });
      assert.equal(replaced.status, "generated");
      assert.match(readFileSync(snapshotSyncedErrorsPath(outputDir), "utf8"), /'v2'/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("consolidateAtlasRelease production snapshot refresh", () => {
  it(
    "replaces the current-version production snapshot when consolidation runs again",
    { timeout: 180_000 },
    () => {
      const dir = mkdtempSync(path.join(os.tmpdir(), "atlas-consolidate-snapshot-"));
      const version = "0.8.3";

      try {
        writeConsolidateChangelogFixture(dir, version);
        writeMiniAtlasReleaseTree(dir, version, "export const errors = 'consolidate-v1';\n");

        consolidateAtlasRelease(dir);
        const firstSnapshotPath = consolidateSnapshotSyncedErrorsPath(dir, version);
        assert.equal(existsSync(firstSnapshotPath), true);
        assert.match(readFileSync(firstSnapshotPath, "utf8"), /consolidate-v1/);

        writeFileSync(
          path.join(dir, "apps/web/src/lib/api/errors.ts"),
          "export const errors = 'consolidate-v2';\n"
        );

        consolidateAtlasRelease(dir);
        assert.match(readFileSync(firstSnapshotPath, "utf8"), /consolidate-v2/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  );
});

describe("generateCurrentProductionReleaseSnapshot direct invocation", () => {
  it(
    "still skips an existing output directory when replace is not requested",
    { timeout: 120_000 },
    () => {
      const outputRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-snapshot-direct-skip-"));
      const atlasVersion = JSON.parse(
        readFileSync(path.join(repoRoot, "packages/cli/package.json"), "utf8")
      ).version;
      const outputDir = path.join(outputRoot, atlasVersion);
      const syncedPath = path.join(outputDir, "apps/web/src/lib/api/errors.ts");

      try {
        generateCurrentProductionReleaseSnapshot(repoRoot, { outputDir, replace: true });
        assert.equal(existsSync(syncedPath), true);

        const before = readFileSync(syncedPath, "utf8");
        writeFileSync(syncedPath, `${before}\n// stale-snapshot-marker\n`);

        generateCurrentProductionReleaseSnapshot(repoRoot, { outputDir });
        assert.match(readFileSync(syncedPath, "utf8"), /stale-snapshot-marker/);
      } finally {
        rmSync(outputRoot, { recursive: true, force: true });
      }
    }
  );
});
