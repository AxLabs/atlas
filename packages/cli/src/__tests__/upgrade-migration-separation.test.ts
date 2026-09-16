import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { FIXTURE_MIGRATION_REGISTRY } from "./fixtures/upgrade-migrations/registry";
import { listRegisteredMigrations } from "../upgrade/migrations/registry";
import { runUpgrade } from "../upgrade/run";

const FIXTURE_ROOT = path.resolve(__dirname, "fixtures/upgrade-e2e");
const UPGRADE_MIGRATIONS_DIR = path.resolve(__dirname, "../upgrade/migrations");

function copyFixtureToTemp(): string {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-upgrade-separation-"));
  cpSync(FIXTURE_ROOT, tempRoot, { recursive: true });
  return tempRoot;
}

function listProductionMigrationSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listProductionMigrationSourceFiles(absolutePath));
      continue;
    }

    if (entry.name.endsWith(".ts")) {
      files.push(absolutePath);
    }
  }

  return files;
}

describe("upgrade migration runtime separation", () => {
  it("keeps production migration registry free of fixture migration IDs", () => {
    expect(listRegisteredMigrations().map((entry) => entry.id)).toEqual([]);
    expect(listRegisteredMigrations().some((entry) => entry.id.includes("fixture"))).toBe(false);
  });

  it("does not ship fixture migration implementations in production source", () => {
    const forbiddenPatterns = [
      "FIXTURE_MIGRATION_REGISTRY",
      "fixture-migration-a",
      "fixture-migration-b",
      "atlas-upgrade-fixture",
      "resolveUpgradeMigrationRegistry",
      "fixture-registry",
    ];

    for (const filePath of listProductionMigrationSourceFiles(UPGRADE_MIGRATIONS_DIR)) {
      const source = readFileSync(filePath, "utf8");
      for (const pattern of forbiddenPatterns) {
        expect(source).not.toContain(pattern);
      }
    }
  });

  it("defaults runUpgrade to the production registry", async () => {
    const tempRoot = copyFixtureToTemp();
    const fixtureContractBefore = readFileSync(
      path.join(tempRoot, "fixture.contract.json"),
      "utf8"
    );

    const result = await runUpgrade({
      repoRoot: tempRoot,
      targetVersion: "0.2.0",
      allowDirty: true,
      skipValidation: true,
      releasesDir: path.join(tempRoot, "releases"),
    });

    expect(result.status).toBe("success");
    expect(result.migrations).toEqual([]);
    expect(readFileSync(path.join(tempRoot, "fixture.contract.json"), "utf8")).toBe(
      fixtureContractBefore
    );

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("accepts explicit fixture registry injection for migration engine coverage", async () => {
    const tempRoot = copyFixtureToTemp();

    const result = await runUpgrade({
      repoRoot: tempRoot,
      targetVersion: "0.3.0",
      allowDirty: true,
      skipValidation: true,
      releasesDir: path.join(tempRoot, "releases"),
      migrationRegistry: FIXTURE_MIGRATION_REGISTRY,
    });

    expect(result.status).toBe("success");
    expect(result.migrations.map((entry) => entry.id)).toEqual([
      "fixture-migration-a",
      "fixture-migration-b",
    ]);

    const fixtureContract = JSON.parse(
      readFileSync(path.join(tempRoot, "fixture.contract.json"), "utf8")
    );
    expect(fixtureContract.newKey).toBe(true);

    rmSync(tempRoot, { recursive: true, force: true });
  });
});
