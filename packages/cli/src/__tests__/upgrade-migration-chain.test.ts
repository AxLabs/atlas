import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  hasMigrationRunner,
  resolveMigrationChain,
  runMigrationChain,
} from "../upgrade/migrations/registry";

function copyFixtureToTemp(): string {
  const sourceRoot = path.resolve(__dirname, "fixtures/upgrade-e2e");
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-upgrade-migration-"));
  cpSync(sourceRoot, tempRoot, { recursive: true });
  return tempRoot;
}

describe("upgrade migration chain", () => {
  it("resolves ordered migrations for multi-step upgrades", () => {
    const chain = resolveMigrationChain("0.1.0", "0.3.0");
    expect(chain.missingTarget).toBeUndefined();
    expect(chain.migrations.map((entry) => entry.id)).toEqual([
      "atlas-rehearsal-step-a",
      "atlas-contract-v1-to-v2",
    ]);
  });

  it("executes migration A before migration B with real mutations", () => {
    const tempRoot = copyFixtureToTemp();
    const executionOrder: string[] = [];

    const chain = resolveMigrationChain("0.1.0", "0.3.0").migrations;
    expect(hasMigrationRunner("atlas-rehearsal-step-a")).toBe(true);
    expect(hasMigrationRunner("atlas-contract-v1-to-v2")).toBe(true);

    const results = runMigrationChain(chain, { repoRoot: tempRoot, dryRun: false });
    for (const result of results) {
      executionOrder.push(result.migrationId);
    }

    expect(executionOrder).toEqual(["atlas-rehearsal-step-a", "atlas-contract-v1-to-v2"]);

    const contract = JSON.parse(readFileSync(path.join(tempRoot, "atlas.config.json"), "utf8"));
    expect(contract.platform.migrationRehearsal.stepB).toBe(true);
    expect(contract.platform.migrationRehearsal.newFlag).toBe(true);
    expect(contract.platform.migrationRehearsal.legacyFlag).toBeUndefined();

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("fails prerequisite when migration chain edge is missing", () => {
    const chain = resolveMigrationChain("0.1.0", "0.4.0");
    expect(chain.missingTarget).toBe("0.4.0");
    expect(chain.migrations.map((entry) => entry.id)).toEqual([
      "atlas-rehearsal-step-a",
      "atlas-contract-v1-to-v2",
    ]);
  });
});
