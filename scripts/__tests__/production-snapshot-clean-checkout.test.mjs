import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { generateCurrentProductionReleaseSnapshot } from "../consolidate-atlas-release.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const atlasVersion = JSON.parse(
  readFileSync(path.join(repoRoot, "packages/cli/package.json"), "utf8")
).version;
const committedSnapshotPath = path.join(
  repoRoot,
  "packages/cli/release-assets/production",
  atlasVersion,
  "release.snapshot.json"
);
const projectDistIndex = path.join(repoRoot, "packages/project/dist/index.js");
const projectTsbuildinfo = path.join(repoRoot, "packages/project/tsconfig.build.tsbuildinfo");

function hashFile(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

describe("production snapshot clean-checkout generation", () => {
  it(
    "succeeds without a pre-existing @atlas/project dist",
    { timeout: 120_000 },
    () => {
      assert.equal(typeof atlasVersion, "string");
      assert.notEqual(atlasVersion.length, 0);
      assert.equal(existsSync(committedSnapshotPath), true);
      const committedHashBefore = hashFile(committedSnapshotPath);

      const outputRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-snapshot-clean-checkout-"));
      const outputDir = path.join(outputRoot, atlasVersion);

      try {
        rmSync(path.dirname(projectDistIndex), { recursive: true, force: true });
        rmSync(projectTsbuildinfo, { force: true });
        assert.equal(existsSync(projectDistIndex), false);

        const result = generateCurrentProductionReleaseSnapshot(repoRoot, { outputDir });
        assert.equal(result.status, "ran");

        const generatedSnapshotPath = path.join(outputDir, "release.snapshot.json");
        assert.equal(existsSync(generatedSnapshotPath), true);

        const generated = JSON.parse(readFileSync(generatedSnapshotPath, "utf8"));
        assert.equal(generated.atlasVersion, atlasVersion);
        assert.equal(generated.packageVersions["@blitzcraftlabs/atlas"], atlasVersion);
        assert.equal(
          existsSync(projectDistIndex),
          true,
          "snapshot generation must build @atlas/project itself"
        );
        assert.equal(hashFile(committedSnapshotPath), committedHashBefore);
      } finally {
        rmSync(outputRoot, { recursive: true, force: true });
      }
    }
  );
});
