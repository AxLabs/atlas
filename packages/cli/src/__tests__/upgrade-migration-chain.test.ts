import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { FIXTURE_MIGRATION_REGISTRY } from "./fixtures/upgrade-migrations/registry";
import type { AtlasMigrationDefinition } from "../upgrade/migrations/types";

function copyFixtureToTemp(): string {
  const sourceRoot = path.resolve(__dirname, "fixtures/upgrade-e2e");
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-upgrade-migration-"));
  cpSync(sourceRoot, tempRoot, { recursive: true });
  return tempRoot;
}

describe("upgrade migration chain", () => {
  it("resolves ordered migrations for multi-step fixture upgrades", () => {
    const chain = FIXTURE_MIGRATION_REGISTRY.resolveChain("0.1.0", "0.3.0");
    expect(chain.missingTarget).toBeUndefined();
    expect(chain.migrations.map((entry: AtlasMigrationDefinition) => entry.id)).toEqual([
      "fixture-migration-a",
      "fixture-migration-b",
    ]);
  });

  it("executes fixture migration A before migration B with real mutations", () => {
    const tempRoot = copyFixtureToTemp();
    const executionOrder: string[] = [];

    const chain = FIXTURE_MIGRATION_REGISTRY.resolveChain("0.1.0", "0.3.0").migrations;
    expect(FIXTURE_MIGRATION_REGISTRY.hasRunner("fixture-migration-a")).toBe(true);
    expect(FIXTURE_MIGRATION_REGISTRY.hasRunner("fixture-migration-b")).toBe(true);

    const results = FIXTURE_MIGRATION_REGISTRY.runChain(chain, {
      repoRoot: tempRoot,
      dryRun: false,
    });
    for (const result of results) {
      executionOrder.push(result.migrationId);
    }

    expect(executionOrder).toEqual(["fixture-migration-a", "fixture-migration-b"]);

    const contract = JSON.parse(readFileSync(path.join(tempRoot, "fixture.contract.json"), "utf8"));
    expect(contract.stepB).toBe(true);
    expect(contract.newKey).toBe(true);
    expect(contract.legacyKey).toBeUndefined();
    expect(contract.schemaVersion).toBe(2);

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("returns the registered fixture chain when target is beyond the last fixture migration", () => {
    const chain = FIXTURE_MIGRATION_REGISTRY.resolveChain("0.1.0", "0.4.0");
    expect(chain.missingTarget).toBeUndefined();
    expect(chain.migrations.map((entry: AtlasMigrationDefinition) => entry.id)).toEqual([
      "fixture-migration-a",
      "fixture-migration-b",
    ]);
  });
});
