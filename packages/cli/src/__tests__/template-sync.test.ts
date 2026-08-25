import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { CliError } from "../errors/cli-error";
import { runSyncInfrastructureCommand } from "../commands/sync";
import { runTemplateInfrastructureSyncCheck } from "../doctor/template-sync";
import { createDoctorContext } from "../doctor/context";
import { DoctorDiagnosticCode } from "../doctor/diagnostics";
import { compareAppInfrastructureManifest } from "../template-sync/compare";
import {
  APP_INFRASTRUCTURE_MANIFEST_RELATIVE_PATH,
  loadAppInfrastructureManifest,
} from "../template-sync/manifest";
import { planTemplateSyncActions, applyTemplateSyncActions } from "../template-sync/sync";

function writeManifest(tempRoot: string, manifest: Record<string, unknown>): void {
  mkdirSync(path.join(tempRoot, "templates"), { recursive: true });
  writeFileSync(
    path.join(tempRoot, APP_INFRASTRUCTURE_MANIFEST_RELATIVE_PATH),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
}

function baseFixtureManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    canonicalApplication: "apps/web",
    consumerApplications: ["apps/reference"],
    syncedPaths: ["src/lib/api/client.ts"],
    generatedPaths: [],
    independentPaths: {},
    referenceOnlyPaths: [],
    starterOnlyPaths: [],
    structuralConformance: { requiredInfrastructureModules: [] },
    ...overrides,
  };
}

function writeMinimalAtlasRepo(tempRoot: string): void {
  writeFileSync(
    path.join(tempRoot, "package.json"),
    `${JSON.stringify({ name: "@atlas/monorepo", version: "0.1.0", private: true }, null, 2)}\n`
  );
  writeFileSync(
    path.join(tempRoot, "atlas.config.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        features: {
          reference: "apps/reference/src/features",
          examples: "apps/web/src/features/examples",
        },
        reference: {
          components: "apps/reference/src/features/components",
          routes: "apps/reference/src/app",
        },
        generated: {
          openApi: {
            schema: "apps/web/src/lib/api/contracts/schema.ts",
          },
        },
        capabilities: {
          openApi: false,
        },
      },
      null,
      2
    )}\n`
  );
  mkdirSync(path.join(tempRoot, "packages/ui"), { recursive: true });
  writeFileSync(
    path.join(tempRoot, "packages/ui/package.json"),
    `${JSON.stringify({ name: "@atlas/ui", version: "0.1.0", private: true }, null, 2)}\n`
  );
  mkdirSync(path.join(tempRoot, "apps/web/src/features"), { recursive: true });
  mkdirSync(path.join(tempRoot, "apps/web/src/features/examples"), { recursive: true });
  mkdirSync(path.join(tempRoot, "apps/reference/src/features/components"), { recursive: true });
  mkdirSync(path.join(tempRoot, "apps/reference/src/app"), { recursive: true });
}

function createFixtureTree(tempRoot: string): void {
  writeMinimalAtlasRepo(tempRoot);
  const canonicalRoot = path.join(tempRoot, "apps/web");
  const consumerRoot = path.join(tempRoot, "apps/reference");
  mkdirSync(path.join(canonicalRoot, "src/lib/api"), { recursive: true });
  mkdirSync(path.join(consumerRoot, "src/lib/api"), { recursive: true });
  writeFileSync(
    path.join(canonicalRoot, "src/lib/api/client.ts"),
    "export const canonical = true;\n"
  );
  writeFileSync(
    path.join(consumerRoot, "src/lib/api/client.ts"),
    "export const canonical = true;\n"
  );
}

describe("template infrastructure sync", () => {
  const repoRoot = path.resolve(__dirname, "../../../../");
  const manifest = loadAppInfrastructureManifest(repoRoot);

  it("loads the repository manifest", () => {
    expect(manifest.canonicalApplication).toBe("apps/web");
    expect(manifest.consumerApplications).toContain("apps/reference");
    expect(manifest.syncedPaths.length).toBeGreaterThan(0);
    expect(manifest.generatedPaths).toContain("src/lib/api/contracts/schema.ts");
    expect(manifest.syncedPaths).not.toContain("src/lib/api/contracts/schema.ts");
  });

  it("reports no drift on the healthy checkout", () => {
    const comparison = compareAppInfrastructureManifest(repoRoot, manifest);
    expect(comparison.drifts).toEqual([]);
    expect(comparison.structuralIssues).toEqual([]);
  });

  it("detects content drift in a temporary fixture", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-template-sync-"));
    createFixtureTree(tempRoot);
    writeFileSync(
      path.join(tempRoot, "apps/reference/src/lib/api/client.ts"),
      "export const consumer = true;\n"
    );
    writeManifest(tempRoot, baseFixtureManifest());

    const fixtureManifest = loadAppInfrastructureManifest(tempRoot);
    const comparison = compareAppInfrastructureManifest(tempRoot, fixtureManifest);
    expect(comparison.drifts).toHaveLength(1);
    expect(comparison.drifts[0]?.kind).toBe("content-drift");

    const actions = planTemplateSyncActions(tempRoot, fixtureManifest, comparison.drifts);
    expect(actions).toHaveLength(1);
    applyTemplateSyncActions(tempRoot, actions, false);
    expect(
      readFileSync(path.join(tempRoot, "apps/reference/src/lib/api/client.ts"), "utf8")
    ).toContain("canonical");

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("passes when synced paths are byte-identical", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-template-sync-"));
    createFixtureTree(tempRoot);
    writeManifest(tempRoot, baseFixtureManifest());

    const fixtureManifest = loadAppInfrastructureManifest(tempRoot);
    const comparison = compareAppInfrastructureManifest(tempRoot, fixtureManifest);
    expect(comparison.drifts).toEqual([]);

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("fails when synced paths diverge", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-template-sync-"));
    createFixtureTree(tempRoot);
    writeFileSync(
      path.join(tempRoot, "apps/reference/src/lib/api/client.ts"),
      "export const consumer = true;\n"
    );
    writeManifest(tempRoot, baseFixtureManifest());

    const comparison = compareAppInfrastructureManifest(
      tempRoot,
      loadAppInfrastructureManifest(tempRoot)
    );
    expect(comparison.drifts).toHaveLength(1);

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("passes when independent paths are byte-identical to canonical", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-template-sync-"));
    createFixtureTree(tempRoot);
    writeFileSync(
      path.join(tempRoot, "apps/web/src/lib/api/index.ts"),
      "export const shared = true;\n"
    );
    writeFileSync(
      path.join(tempRoot, "apps/reference/src/lib/api/index.ts"),
      "export const shared = true;\n"
    );
    writeManifest(
      tempRoot,
      baseFixtureManifest({
        independentPaths: {
          "apps/reference": {
            "src/lib/api/index.ts": "Reference may customize API wiring",
          },
        },
      })
    );

    const comparison = compareAppInfrastructureManifest(
      tempRoot,
      loadAppInfrastructureManifest(tempRoot)
    );
    expect(comparison.drifts).toEqual([]);

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("passes when independent paths diverge from canonical", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-template-sync-"));
    createFixtureTree(tempRoot);
    writeFileSync(
      path.join(tempRoot, "apps/web/src/lib/api/index.ts"),
      "export const starter = true;\n"
    );
    writeFileSync(
      path.join(tempRoot, "apps/reference/src/lib/api/index.ts"),
      "export const reference = true;\n"
    );
    writeManifest(
      tempRoot,
      baseFixtureManifest({
        independentPaths: {
          "apps/reference": {
            "src/lib/api/index.ts": "Reference may customize API wiring",
          },
        },
      })
    );

    const comparison = compareAppInfrastructureManifest(
      tempRoot,
      loadAppInfrastructureManifest(tempRoot)
    );
    expect(comparison.drifts).toEqual([]);

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("detects missing consumer synced paths", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-template-sync-"));
    createFixtureTree(tempRoot);
    rmSync(path.join(tempRoot, "apps/reference/src/lib/api/client.ts"));
    writeManifest(tempRoot, baseFixtureManifest());

    const comparison = compareAppInfrastructureManifest(
      tempRoot,
      loadAppInfrastructureManifest(tempRoot)
    );
    expect(comparison.drifts).toHaveLength(1);
    expect(comparison.drifts[0]?.kind).toBe("missing-in-consumer");

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("does not copy generated paths during template sync", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-template-sync-"));
    createFixtureTree(tempRoot);
    mkdirSync(path.join(tempRoot, "apps/web/src/lib/api/contracts"), { recursive: true });
    mkdirSync(path.join(tempRoot, "apps/reference/src/lib/api/contracts"), { recursive: true });
    writeFileSync(
      path.join(tempRoot, "apps/web/src/lib/api/contracts/schema.ts"),
      "export const generatedStarter = true;\n"
    );
    writeFileSync(
      path.join(tempRoot, "apps/reference/src/lib/api/contracts/schema.ts"),
      "export const generatedReference = true;\n"
    );
    writeManifest(
      tempRoot,
      baseFixtureManifest({
        generatedPaths: ["src/lib/api/contracts/schema.ts"],
      })
    );

    const fixtureManifest = loadAppInfrastructureManifest(tempRoot);
    const comparison = compareAppInfrastructureManifest(tempRoot, fixtureManifest);
    expect(comparison.drifts).toEqual([]);

    const actions = planTemplateSyncActions(tempRoot, fixtureManifest, comparison.drifts);
    expect(actions).toEqual([]);

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("reports starter-only paths present in consumer applications", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-template-sync-"));
    createFixtureTree(tempRoot);
    mkdirSync(path.join(tempRoot, "apps/web/src/components"), { recursive: true });
    mkdirSync(path.join(tempRoot, "apps/reference/src/components"), { recursive: true });
    writeFileSync(path.join(tempRoot, "apps/web/src/components/LandingSelect.tsx"), "export {};\n");
    writeFileSync(
      path.join(tempRoot, "apps/reference/src/components/LandingSelect.tsx"),
      "export {};\n"
    );
    writeManifest(
      tempRoot,
      baseFixtureManifest({
        starterOnlyPaths: ["src/components/LandingSelect.tsx"],
      })
    );

    const comparison = compareAppInfrastructureManifest(
      tempRoot,
      loadAppInfrastructureManifest(tempRoot)
    );
    expect(comparison.structuralIssues).toHaveLength(1);
    expect(comparison.structuralIssues[0]?.kind).toBe("starter-only-present-in-consumer");

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("reports missing reference-only paths in consumer applications", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-template-sync-"));
    createFixtureTree(tempRoot);
    writeManifest(
      tempRoot,
      baseFixtureManifest({
        referenceOnlyPaths: ["src/lib/reference/index.ts"],
      })
    );

    const comparison = compareAppInfrastructureManifest(
      tempRoot,
      loadAppInfrastructureManifest(tempRoot)
    );
    expect(comparison.structuralIssues).toHaveLength(1);
    expect(comparison.structuralIssues[0]?.kind).toBe("reference-only-missing");

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("repairs drift and reports healthy post-sync state", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-template-sync-"));
    createFixtureTree(tempRoot);
    writeFileSync(
      path.join(tempRoot, "apps/reference/src/lib/api/client.ts"),
      "export const consumer = true;\n"
    );
    writeManifest(tempRoot, baseFixtureManifest());

    const checkBefore = runSyncInfrastructureCommand({ cwd: tempRoot, check: true });
    expect(checkBefore.ok).toBe(false);
    expect(checkBefore.remainingDrifts).toBe(1);

    const dryRun = runSyncInfrastructureCommand({ cwd: tempRoot, dryRun: true });
    expect(dryRun.ok).toBe(false);
    expect(dryRun.appliedActions).toBe(0);
    expect(
      readFileSync(path.join(tempRoot, "apps/reference/src/lib/api/client.ts"), "utf8")
    ).toContain("consumer");

    const repaired = runSyncInfrastructureCommand({ cwd: tempRoot });
    expect(repaired.ok).toBe(true);
    expect(repaired.appliedActions).toBe(1);
    expect(repaired.remainingDrifts).toBe(0);
    expect(
      readFileSync(path.join(tempRoot, "apps/reference/src/lib/api/client.ts"), "utf8")
    ).toContain("canonical");

    const checkAfter = runSyncInfrastructureCommand({ cwd: tempRoot, check: true });
    expect(checkAfter.ok).toBe(true);
    expect(checkAfter.remainingDrifts).toBe(0);

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("remains unhealthy when structural issues are not automatically repairable", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-template-sync-"));
    createFixtureTree(tempRoot);
    mkdirSync(path.join(tempRoot, "apps/web/src/components"), { recursive: true });
    mkdirSync(path.join(tempRoot, "apps/reference/src/components"), { recursive: true });
    writeFileSync(path.join(tempRoot, "apps/web/src/components/LandingSelect.tsx"), "export {};\n");
    writeFileSync(
      path.join(tempRoot, "apps/reference/src/components/LandingSelect.tsx"),
      "export {};\n"
    );
    writeManifest(
      tempRoot,
      baseFixtureManifest({
        starterOnlyPaths: ["src/components/LandingSelect.tsx"],
      })
    );

    const result = runSyncInfrastructureCommand({ cwd: tempRoot });
    expect(result.ok).toBe(false);
    expect(result.remainingStructuralIssues).toBe(1);

    rmSync(tempRoot, { recursive: true, force: true });
  });
});

describe("application infrastructure manifest validation", () => {
  function expectManifestError(
    tempRoot: string,
    manifest: Record<string, unknown>,
    message: string
  ) {
    writeManifest(tempRoot, manifest);
    expect(() => loadAppInfrastructureManifest(tempRoot)).toThrow(CliError);
    try {
      loadAppInfrastructureManifest(tempRoot);
    } catch (error) {
      expect((error as CliError).message).toContain(message);
    }
  }

  it("rejects unsupported schema versions", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-manifest-"));
    expectManifestError(tempRoot, baseFixtureManifest({ schemaVersion: 2 }), "Unsupported");
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("rejects wrong value types", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-manifest-"));
    expectManifestError(
      tempRoot,
      baseFixtureManifest({ syncedPaths: "not-an-array" }),
      "syncedPaths"
    );
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("rejects duplicate synced paths", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-manifest-"));
    expectManifestError(
      tempRoot,
      baseFixtureManifest({
        syncedPaths: ["src/lib/api/client.ts", "src/lib/api/client.ts"],
      }),
      "duplicate entry"
    );
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("rejects classification overlap between synced and generated paths", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-manifest-"));
    expectManifestError(
      tempRoot,
      baseFixtureManifest({
        syncedPaths: ["src/lib/api/client.ts"],
        generatedPaths: ["src/lib/api/client.ts"],
      }),
      "classified as both"
    );
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("rejects absolute infrastructure paths", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-manifest-"));
    expectManifestError(
      tempRoot,
      baseFixtureManifest({ syncedPaths: ["/src/lib/api/client.ts"] }),
      "absolute paths are not allowed"
    );
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("rejects traversal infrastructure paths", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-manifest-"));
    expectManifestError(
      tempRoot,
      baseFixtureManifest({ syncedPaths: ["../outside.ts"] }),
      "path traversal is not allowed"
    );
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("rejects canonical application listed as consumer", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-manifest-"));
    expectManifestError(
      tempRoot,
      baseFixtureManifest({
        consumerApplications: ["apps/web", "apps/reference"],
      }),
      "must not also appear in consumerApplications"
    );
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("rejects unknown independentPaths application keys", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-manifest-"));
    expectManifestError(
      tempRoot,
      baseFixtureManifest({
        independentPaths: {
          "apps/other": {
            "src/lib/api/client.ts": "reason",
          },
        },
      }),
      "unknown consumer application"
    );
    rmSync(tempRoot, { recursive: true, force: true });
  });
});

describe("doctor template infrastructure sync", () => {
  it("passes on the healthy checkout", () => {
    const repoRoot = path.resolve(__dirname, "../../../../");
    const context = createDoctorContext({ cwd: repoRoot });
    const result = runTemplateInfrastructureSyncCheck(context);
    expect(result.status).toBe("pass");
  });

  it("reports template drift without treating independent equality as failure", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-doctor-template-"));
    createFixtureTree(tempRoot);
    writeFileSync(
      path.join(tempRoot, "apps/reference/src/lib/api/client.ts"),
      "export const consumer = true;\n"
    );
    writeManifest(tempRoot, baseFixtureManifest());

    const context = createDoctorContext({ cwd: tempRoot });
    const driftResult = runTemplateInfrastructureSyncCheck(context);
    expect(driftResult.status).toBe("fail");
    expect(driftResult.diagnostics[0]?.code).toBe(DoctorDiagnosticCode.TEMPLATE_SYNC_DRIFT);

    writeFileSync(
      path.join(tempRoot, "apps/reference/src/lib/api/client.ts"),
      "export const canonical = true;\n"
    );
    writeFileSync(
      path.join(tempRoot, "apps/web/src/lib/api/index.ts"),
      "export const shared = true;\n"
    );
    writeFileSync(
      path.join(tempRoot, "apps/reference/src/lib/api/index.ts"),
      "export const shared = true;\n"
    );
    writeManifest(
      tempRoot,
      baseFixtureManifest({
        independentPaths: {
          "apps/reference": {
            "src/lib/api/index.ts": "Reference may customize API wiring",
          },
        },
      })
    );

    const equalIndependentContext = createDoctorContext({ cwd: tempRoot });
    const equalIndependentResult = runTemplateInfrastructureSyncCheck(equalIndependentContext);
    expect(equalIndependentResult.status).toBe("pass");

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("reports malformed manifests with stable diagnostic codes", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-doctor-template-"));
    writeMinimalAtlasRepo(tempRoot);
    writeManifest(tempRoot, baseFixtureManifest({ syncedPaths: ["../bad.ts"] }));

    const context = createDoctorContext({ cwd: tempRoot });
    const result = runTemplateInfrastructureSyncCheck(context);
    expect(result.status).toBe("fail");
    expect(result.diagnostics[0]?.code).toBe(DoctorDiagnosticCode.TEMPLATE_SYNC_MANIFEST_INVALID);

    rmSync(tempRoot, { recursive: true, force: true });
  });
});
