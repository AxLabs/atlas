import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import * as doctorModule from "../doctor";
import { runUpgrade } from "../upgrade/run";
import * as migrationRegistry from "../upgrade/migrations/registry";

const FIXTURE_ROOT = path.resolve(__dirname, "fixtures/upgrade-e2e");

function copyFixtureToTemp(): string {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-upgrade-run-"));
  cpSync(FIXTURE_ROOT, tempRoot, { recursive: true });
  return tempRoot;
}

describe("upgrade run integration", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("runs doctor during apply when validation is enabled", async () => {
    const tempRoot = copyFixtureToTemp();
    const doctorSpy = jest.spyOn(doctorModule, "runDoctor").mockResolvedValue({
      schemaVersion: 1,
      status: "healthy",
      atlasVersion: "0.2.0",
      projectRoot: ".",
      summary: {
        checksPassed: 1,
        checksWarned: 0,
        checksFailed: 0,
        checksSkipped: 0,
        diagnosticWarnings: 0,
        diagnosticErrors: 0,
      },
      checks: [],
      diagnostics: [],
    });

    const result = await runUpgrade({
      repoRoot: tempRoot,
      targetVersion: "0.2.0",
      allowDirty: true,
      skipValidation: false,
    });

    expect(doctorSpy).toHaveBeenCalled();
    expect(result.status).toBe("success");
    expect(result.validation.doctor).toBe("passed");
    expect(result.baselineUpdated).toBe(true);
    expect(JSON.parse(readFileSync(path.join(tempRoot, "package.json"), "utf8")).version).toBe(
      "0.2.0"
    );

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("preserves consumer-owned files byte-for-byte across upgrade", async () => {
    const tempRoot = copyFixtureToTemp();
    const consumerOwnedPath = path.join(tempRoot, "apps/web/src/features/billing/custom-work.ts");
    const before = readFileSync(consumerOwnedPath, "utf8");

    jest.spyOn(doctorModule, "runDoctor").mockResolvedValue({
      schemaVersion: 1,
      status: "healthy",
      atlasVersion: "0.2.0",
      projectRoot: ".",
      summary: {
        checksPassed: 1,
        checksWarned: 0,
        checksFailed: 0,
        checksSkipped: 0,
        diagnosticWarnings: 0,
        diagnosticErrors: 0,
      },
      checks: [],
      diagnostics: [],
    });

    const result = await runUpgrade({
      repoRoot: tempRoot,
      targetVersion: "0.2.0",
      allowDirty: true,
      skipValidation: false,
    });

    expect(result.status).toBe("success");
    expect(readFileSync(consumerOwnedPath, "utf8")).toBe(before);

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("reports exactly one terminal migration result per migration", async () => {
    const tempRoot = copyFixtureToTemp();

    jest.spyOn(doctorModule, "runDoctor").mockResolvedValue({
      schemaVersion: 1,
      status: "healthy",
      atlasVersion: "0.2.0",
      projectRoot: ".",
      summary: {
        checksPassed: 1,
        checksWarned: 0,
        checksFailed: 0,
        checksSkipped: 0,
        diagnosticWarnings: 0,
        diagnosticErrors: 0,
      },
      checks: [],
      diagnostics: [],
    });

    const result = await runUpgrade({
      repoRoot: tempRoot,
      targetVersion: "0.2.0",
      allowDirty: true,
      skipValidation: true,
    });

    const ids = result.migrations.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(result.migrations).toEqual([
      expect.objectContaining({ id: "atlas-rehearsal-step-a", status: "applied" }),
    ]);

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("executes multi-step migrations in order and advances baseline only after success", async () => {
    const tempRoot = copyFixtureToTemp();

    jest.spyOn(doctorModule, "runDoctor").mockResolvedValue({
      schemaVersion: 1,
      status: "healthy",
      atlasVersion: "0.3.0",
      projectRoot: ".",
      summary: {
        checksPassed: 1,
        checksWarned: 0,
        checksFailed: 0,
        checksSkipped: 0,
        diagnosticWarnings: 0,
        diagnosticErrors: 0,
      },
      checks: [],
      diagnostics: [],
    });

    const result = await runUpgrade({
      repoRoot: tempRoot,
      targetVersion: "0.3.0",
      allowDirty: true,
      skipValidation: true,
    });

    expect(result.status).toBe("success");
    expect(result.migrations.map((entry) => entry.id)).toEqual([
      "atlas-rehearsal-step-a",
      "atlas-contract-v1-to-v2",
    ]);
    expect(result.migrations.every((entry) => entry.status === "applied")).toBe(true);

    const contract = JSON.parse(readFileSync(path.join(tempRoot, "atlas.config.json"), "utf8"));
    expect(contract.platform.baseline.atlasVersion).toBe("0.3.0");
    expect(contract.platform.baseline.contractSchemaVersion).toBe(2);
    expect(contract.platform.migrationRehearsal.newFlag).toBe(true);

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("does not advance baseline when a migration fails", async () => {
    const tempRoot = copyFixtureToTemp();
    const contractBefore = readFileSync(path.join(tempRoot, "atlas.config.json"), "utf8");

    const originalRunMigrationChain = migrationRegistry.runMigrationChain;
    jest.spyOn(migrationRegistry, "runMigrationChain").mockImplementation((migrations, context) => {
      if (migrations.some((entry) => entry.id === "atlas-contract-v1-to-v2")) {
        migrationRegistry.runMigration("atlas-rehearsal-step-a", context);
        throw new Error("migration B failed");
      }

      return originalRunMigrationChain(migrations, context);
    });

    const result = await runUpgrade({
      repoRoot: tempRoot,
      targetVersion: "0.3.0",
      allowDirty: true,
      skipValidation: true,
    });

    expect(result.status).toBe("migration-failed");
    expect(result.baselineUpdated).toBe(false);
    expect(readFileSync(path.join(tempRoot, "atlas.config.json"), "utf8")).not.toBe(contractBefore);

    rmSync(tempRoot, { recursive: true, force: true });
  });
});
