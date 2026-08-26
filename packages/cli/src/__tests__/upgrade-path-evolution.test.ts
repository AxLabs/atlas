import { computeBaselineChecksum } from "@atlas/project";

import { validateUpgradeSourceBaseline } from "../upgrade/baseline-validation";
import { planUpgrade } from "../upgrade/plan";
import { listRegisteredMigrations, resolveMigrationChain } from "../upgrade/migrations/registry";
import { classifyOwnershipTransitions } from "../upgrade/path-transitions";

const SOURCE_SNAPSHOT = {
  "src/lib/api/client.ts": "export const api = 'client';\n",
  "src/lib/api/errors.ts": "export const normalize = () => 'old';\n",
  "src/lib/api/legacy-stub.ts": "export const legacyStub = () => 'baseline';\n",
  "src/lib/auth/session.ts": "export const session = 'baseline';\n",
  "src/lib/application/authz.ts": "export const authz = 'starter';\n",
};

describe("upgrade path evolution", () => {
  const sourceSyncedPaths = [
    "src/lib/api/client.ts",
    "src/lib/api/errors.ts",
    "src/lib/api/legacy-stub.ts",
    "src/lib/auth/session.ts",
  ];
  const targetSyncedPaths = [
    "src/lib/api/client.ts",
    "src/lib/api/errors.ts",
    "src/lib/api/platform-marker.ts",
    "src/lib/auth/session.ts",
  ];

  const baselineChecksums = Object.fromEntries(
    sourceSyncedPaths.map((relativePath) => [
      relativePath,
      computeBaselineChecksum(SOURCE_SNAPSHOT[relativePath as keyof typeof SOURCE_SNAPSHOT]!),
    ])
  );

  it("validates source baseline even when target release adds synced paths", () => {
    const issues = validateUpgradeSourceBaseline({
      baseline: {
        atlasVersion: "0.1.0",
        contractSchemaVersion: 1,
        templateManifestSchemaVersion: 1,
        syncedPathChecksums: baselineChecksums,
      },
      sourceSyncedPaths,
      targetSyncedPaths,
      currentManifestSchemaVersion: 1,
    });

    expect(issues).toEqual([]);
  });

  it("plans create for a new synced path absent in the consumer", () => {
    const plan = planUpgrade({
      applicationRoot: "apps/web",
      baselineAtlasVersion: "0.1.0",
      targetAtlasVersion: "0.2.0",
      baselineChecksums,
      sourceSyncedPaths,
      sourceGeneratedPaths: [],
      sourceIndependentPaths: ["src/lib/application/authz.ts"],
      syncedPaths: targetSyncedPaths,
      generatedPaths: [],
      independentPaths: ["src/lib/application/authz.ts"],
      sourceSnapshot: { syncedPaths: SOURCE_SNAPSHOT },
      targetSnapshot: {
        syncedPaths: {
          ...SOURCE_SNAPSHOT,
          "src/lib/api/errors.ts": "export const normalize = () => 'fixed';\n",
          "src/lib/api/platform-marker.ts": "export const platformMarker = () => '0.2.0';\n",
        },
      },
      consumerFiles: { ...SOURCE_SNAPSHOT },
      migrationChain: resolveMigrationChain("0.1.0", "0.2.0").migrations,
    });

    const marker = plan.items.find(
      (item) => item.relativePath === "src/lib/api/platform-marker.ts"
    );
    expect(marker?.action).toBe("create");
    expect(marker?.conflict).toBe(false);
  });

  it("plans manual review when a new synced path already exists in the consumer", () => {
    const plan = planUpgrade({
      applicationRoot: "apps/web",
      baselineAtlasVersion: "0.1.0",
      targetAtlasVersion: "0.2.0",
      baselineChecksums,
      sourceSyncedPaths,
      sourceGeneratedPaths: [],
      sourceIndependentPaths: [],
      syncedPaths: targetSyncedPaths,
      generatedPaths: [],
      independentPaths: [],
      sourceSnapshot: { syncedPaths: SOURCE_SNAPSHOT },
      targetSnapshot: {
        syncedPaths: {
          ...SOURCE_SNAPSHOT,
          "src/lib/api/platform-marker.ts": "export const platformMarker = () => '0.2.0';\n",
        },
      },
      consumerFiles: {
        ...SOURCE_SNAPSHOT,
        "src/lib/api/platform-marker.ts": "export const platformMarker = () => 'consumer';\n",
      },
      migrationChain: resolveMigrationChain("0.1.0", "0.2.0").migrations,
    });

    const marker = plan.items.find(
      (item) => item.relativePath === "src/lib/api/platform-marker.ts"
    );
    expect(marker?.action).toBe("manual-review");
    expect(marker?.conflict).toBe(true);
  });

  it("plans remove for a removed synced path that still matches baseline", () => {
    const plan = planUpgrade({
      applicationRoot: "apps/web",
      baselineAtlasVersion: "0.1.0",
      targetAtlasVersion: "0.2.0",
      baselineChecksums,
      sourceSyncedPaths,
      sourceGeneratedPaths: [],
      sourceIndependentPaths: [],
      syncedPaths: targetSyncedPaths,
      generatedPaths: [],
      independentPaths: [],
      sourceSnapshot: { syncedPaths: SOURCE_SNAPSHOT },
      targetSnapshot: {
        syncedPaths: {
          ...SOURCE_SNAPSHOT,
          "src/lib/api/platform-marker.ts": "export const platformMarker = () => '0.2.0';\n",
        },
      },
      consumerFiles: { ...SOURCE_SNAPSHOT },
      migrationChain: resolveMigrationChain("0.1.0", "0.2.0").migrations,
    });

    const removed = plan.items.find((item) => item.relativePath === "src/lib/api/legacy-stub.ts");
    expect(removed?.action).toBe("remove");
    expect(removed?.conflict).toBe(false);
  });

  it("never deletes automatically when a removed synced path was modified", () => {
    const plan = planUpgrade({
      applicationRoot: "apps/web",
      baselineAtlasVersion: "0.1.0",
      targetAtlasVersion: "0.2.0",
      baselineChecksums,
      sourceSyncedPaths,
      sourceGeneratedPaths: [],
      sourceIndependentPaths: [],
      syncedPaths: targetSyncedPaths,
      generatedPaths: [],
      independentPaths: [],
      sourceSnapshot: { syncedPaths: SOURCE_SNAPSHOT },
      targetSnapshot: {
        syncedPaths: {
          ...SOURCE_SNAPSHOT,
          "src/lib/api/platform-marker.ts": "export const platformMarker = () => '0.2.0';\n",
        },
      },
      consumerFiles: {
        ...SOURCE_SNAPSHOT,
        "src/lib/api/legacy-stub.ts": "export const legacyStub = () => 'consumer-edit';\n",
      },
      migrationChain: resolveMigrationChain("0.1.0", "0.2.0").migrations,
    });

    const removed = plan.items.find((item) => item.relativePath === "src/lib/api/legacy-stub.ts");
    expect(removed?.action).toBe("manual-review");
    expect(removed?.conflict).toBe(true);
  });

  it("detects ownership transitions explicitly", () => {
    const transitions = classifyOwnershipTransitions({
      sourceManifest: {
        syncedPaths: ["src/lib/application/authz.ts"],
        generatedPaths: [],
        independentPaths: [],
      },
      targetManifest: {
        syncedPaths: [],
        generatedPaths: [],
        independentPaths: ["src/lib/application/authz.ts"],
      },
    });

    expect(transitions).toEqual([
      expect.objectContaining({
        relativePath: "src/lib/application/authz.ts",
        kind: "synced-to-independent",
      }),
    ]);
  });

  it("does not treat automatic migration plan items as blocking prerequisites", () => {
    const plan = planUpgrade({
      applicationRoot: "apps/web",
      baselineAtlasVersion: "0.1.0",
      targetAtlasVersion: "0.2.0",
      baselineChecksums,
      sourceSyncedPaths,
      sourceGeneratedPaths: [],
      sourceIndependentPaths: ["src/lib/application/authz.ts"],
      syncedPaths: targetSyncedPaths,
      generatedPaths: [],
      independentPaths: ["src/lib/application/authz.ts"],
      sourceSnapshot: { syncedPaths: SOURCE_SNAPSHOT },
      targetSnapshot: {
        syncedPaths: {
          ...SOURCE_SNAPSHOT,
          "src/lib/api/errors.ts": "export const normalize = () => 'fixed';\n",
          "src/lib/api/platform-marker.ts": "export const platformMarker = () => '0.2.0';\n",
        },
      },
      consumerFiles: { ...SOURCE_SNAPSHOT },
      migrationChain: resolveMigrationChain("0.1.0", "0.2.0").migrations,
    });

    expect(plan.hasIncompleteMigrations).toBe(false);
    expect(plan.items.some((item) => item.migrationId === "atlas-rehearsal-step-a")).toBe(true);
    expect(listRegisteredMigrations().map((entry) => entry.id)).toEqual([
      "atlas-rehearsal-step-a",
      "atlas-contract-v1-to-v2",
    ]);
  });
});
