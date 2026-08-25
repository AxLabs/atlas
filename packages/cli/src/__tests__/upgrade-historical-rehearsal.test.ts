import { readFileSync } from "node:fs";
import path from "node:path";

import { computeBaselineChecksum } from "@atlas/project";

import { planUpgrade } from "../upgrade/plan";

const HISTORICAL_ROOT = path.resolve(__dirname, "fixtures/upgrade-rehearsal/historical");
const METADATA = JSON.parse(readFileSync(path.join(HISTORICAL_ROOT, "metadata.json"), "utf8")) as {
  rehearsalManifestSubset: {
    syncedPaths: string[];
    generatedPaths: string[];
    independentPaths: string[];
  };
};

function readFixture(side: "source" | "target" | "consumer", relativePath: string): string {
  return readFileSync(path.join(HISTORICAL_ROOT, side, "apps/web", relativePath), "utf8");
}

function loadSyncedSnapshot(side: "source" | "target" | "consumer"): Record<string, string> {
  const files: Record<string, string> = {};
  for (const relativePath of METADATA.rehearsalManifestSubset.syncedPaths) {
    files[relativePath] = readFixture(side, relativePath);
  }
  for (const relativePath of METADATA.rehearsalManifestSubset.independentPaths) {
    if (side === "target" || relativePath in files) {
      try {
        files[relativePath] = readFixture(side, relativePath);
      } catch {
        // independent path may not exist in source snapshot
      }
    }
  }
  return files;
}

function loadConsumerFiles(): Record<string, string> {
  const files = loadSyncedSnapshot("consumer");
  files["src/features/billing/index.tsx"] = readFixture(
    "consumer",
    "src/features/billing/index.tsx"
  );
  return files;
}

describe("historical upgrade rehearsal", () => {
  const sourceSynced = loadSyncedSnapshot("source");
  const targetSynced = loadSyncedSnapshot("target");
  const consumerFiles = loadConsumerFiles();

  const baselineChecksums = Object.fromEntries(
    METADATA.rehearsalManifestSubset.syncedPaths.map((relativePath) => [
      relativePath,
      computeBaselineChecksum(sourceSynced[relativePath]!),
    ])
  );

  const plan = planUpgrade({
    applicationRoot: "apps/web",
    baselineAtlasVersion: "0.1.0",
    targetAtlasVersion: "0.1.0",
    baselineChecksums,
    syncedPaths: METADATA.rehearsalManifestSubset.syncedPaths,
    generatedPaths: METADATA.rehearsalManifestSubset.generatedPaths,
    independentPaths: METADATA.rehearsalManifestSubset.independentPaths,
    sourceSnapshot: {
      syncedPaths: sourceSynced,
      generatedPaths: {
        "src/lib/api/contracts/schema.ts": readFixture("source", "src/lib/api/contracts/schema.ts"),
      },
      openApiSpec: readFileSync(path.join(HISTORICAL_ROOT, "source/openapi/openapi.json"), "utf8"),
    },
    targetSnapshot: {
      syncedPaths: targetSynced,
      generatedPaths: {
        "src/lib/api/contracts/schema.ts": readFixture("target", "src/lib/api/contracts/schema.ts"),
      },
      openApiSpec: readFileSync(path.join(HISTORICAL_ROOT, "target/openapi/openapi.json"), "utf8"),
    },
    consumerFiles,
  });

  it("loads provenance metadata for the historical snapshot pair", () => {
    const metadata = JSON.parse(readFileSync(path.join(HISTORICAL_ROOT, "metadata.json"), "utf8"));
    expect(metadata.sourceAtlasCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(metadata.targetAtlasCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(metadata.whyThisBaselineWasChosen).toContain("reference application split");
  });

  it("allows safe replacement for unchanged synced infrastructure Atlas changed", () => {
    const hooks = plan.items.find((item) => item.relativePath === "src/lib/api/hooks.ts");
    expect(hooks?.action).toBe("replace");
    expect(hooks?.conflict).toBe(false);

    const config = plan.items.find((item) => item.relativePath === "src/lib/api/config.ts");
    expect(config?.action).toBe("replace");
    expect(config?.conflict).toBe(false);
  });

  it("requires merge for consumer-customized synced session wiring", () => {
    const session = plan.items.find((item) => item.relativePath === "src/lib/auth/useSession.ts");
    expect(session?.action).toBe("manual-review");
    expect(session?.category).toBe("merge-required");
    expect(session?.conflict).toBe(true);
  });

  it("never touches product-owned billing feature files", () => {
    expect(plan.items.some((item) => item.relativePath.includes("features/billing"))).toBe(false);
  });

  it("requires manual review for independent application authz wiring", () => {
    const authz = plan.items.find((item) => item.relativePath === "src/lib/application/authz.ts");
    expect(authz?.action).toBe("manual-review");
    expect(authz?.ownershipChannel).toBe("consumer-owned-source");
  });

  it("skips generated schema when OpenAPI did not change between snapshots", () => {
    const schema = plan.items.find(
      (item) => item.relativePath === "src/lib/api/contracts/schema.ts"
    );
    expect(schema?.action).toBe("skip");
  });

  it("blocks automatic apply when customized synced paths conflict", () => {
    expect(plan.hasBlockingConflicts).toBe(true);
    expect(plan.summary.mergeRequired).toBeGreaterThanOrEqual(1);
  });
});
