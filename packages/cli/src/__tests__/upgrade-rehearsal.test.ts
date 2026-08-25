import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildPlatformBaseline,
  computeBaselineChecksum,
  hasConsumerModifiedSyncedPath,
  LATEST_SCHEMA_VERSION,
} from "@atlas/project";

import { applySafeUpgradeReplacements } from "../upgrade/apply";
import { captureConsumerPlatformBaseline } from "../upgrade/baseline";
import { planUpgrade } from "../upgrade/plan";

const FIXTURE_ROOT = path.resolve(__dirname, "fixtures/upgrade-rehearsal");

const REHEARSAL_MANIFEST = {
  syncedPaths: ["src/lib/api/client.ts", "src/lib/api/errors.ts", "src/lib/auth/session.ts"],
  generatedPaths: ["src/lib/api/contracts/schema.ts"],
  independentPaths: ["src/lib/application/authz.ts"],
};

const SOURCE_V010 = {
  "src/lib/api/client.ts": "export const apiVersion = '0.1.0';\n",
  "src/lib/api/errors.ts": "export const normalize = () => 'old';\n",
  "src/lib/auth/session.ts": "export const session = 'baseline';\n",
  "src/lib/application/authz.ts": "export const authz = 'starter';\n",
  "src/lib/api/contracts/schema.ts": "export type User = { id: string };\n",
};

const TARGET_V020 = {
  ...SOURCE_V010,
  "src/lib/api/errors.ts": "export const normalize = () => 'fixed';\n",
  "src/lib/auth/session.ts": "export const session = 'secure-baseline';\n",
  "src/lib/application/authz.ts": "export const authz = 'starter-v2';\n",
  "src/lib/api/contracts/schema.ts": "export type User = { id: string; email: string };\n",
};

const CONSUMER_CUSTOM_AUTH = "export const session = 'consumer-custom-auth';\n";
const CONSUMER_PRODUCT_FEATURE = "export const BillingFeature = () => null;\n";

function writeConsumerTree(root: string, files: Record<string, string>): void {
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content, "utf8");
  }
}

function buildBaselineChecksums(files: Record<string, string>): Record<string, string> {
  const entries = Object.entries(files)
    .filter(([relativePath]) => REHEARSAL_MANIFEST.syncedPaths.includes(relativePath))
    .map(([relativePath, content]) => [relativePath, computeBaselineChecksum(content)] as const);

  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
}

describe("upgrade rehearsal", () => {
  it("identifies baseline metadata for an older consumer project state", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-upgrade-baseline-"));
    const applicationRoot = "apps/web";

    writeConsumerTree(path.join(tempRoot, applicationRoot), SOURCE_V010);
    writeFileSync(
      path.join(tempRoot, "package.json"),
      `${JSON.stringify({ name: "@atlas/monorepo", version: "0.1.0" }, null, 2)}\n`
    );

    const baseline = captureConsumerPlatformBaseline({
      repoRoot: tempRoot,
      applicationRoot,
      atlasVersion: "0.1.0",
      contractSchemaVersion: LATEST_SCHEMA_VERSION,
      manifest: {
        schemaVersion: 1,
        canonicalApplication: applicationRoot,
        consumerApplications: [],
        syncedPaths: REHEARSAL_MANIFEST.syncedPaths,
        generatedPaths: REHEARSAL_MANIFEST.generatedPaths,
        independentPaths: {},
        referenceOnlyPaths: [],
        starterOnlyPaths: [],
      },
    });

    expect(baseline.atlasVersion).toBe("0.1.0");
    expect(baseline.syncedPathChecksums["src/lib/api/client.ts"]).toMatch(/^sha256:/);

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("plans safe replacements, conflicts, regeneration, and consumer-owned skips", () => {
    const consumerFiles = {
      ...SOURCE_V010,
      "src/lib/auth/session.ts": CONSUMER_CUSTOM_AUTH,
      "src/features/billing/index.ts": CONSUMER_PRODUCT_FEATURE,
    };

    const baselineChecksums = buildBaselineChecksums(SOURCE_V010);

    const plan = planUpgrade({
      applicationRoot: "apps/web",
      baselineAtlasVersion: "0.1.0",
      targetAtlasVersion: "0.2.0",
      baselineChecksums,
      syncedPaths: REHEARSAL_MANIFEST.syncedPaths,
      generatedPaths: REHEARSAL_MANIFEST.generatedPaths,
      independentPaths: REHEARSAL_MANIFEST.independentPaths,
      sourceSnapshot: {
        syncedPaths: SOURCE_V010,
        generatedPaths: {
          "src/lib/api/contracts/schema.ts": SOURCE_V010["src/lib/api/contracts/schema.ts"]!,
        },
        openApiSpec: '{"openapi":"3.0.0","paths":{}}',
      },
      targetSnapshot: {
        syncedPaths: TARGET_V020,
        generatedPaths: {
          "src/lib/api/contracts/schema.ts": TARGET_V020["src/lib/api/contracts/schema.ts"]!,
        },
        openApiSpec: '{"openapi":"3.0.0","paths":{"/users":{}}}',
      },
      consumerFiles,
    });

    const errorsItem = plan.items.find((item) => item.relativePath === "src/lib/api/errors.ts");
    expect(errorsItem?.action).toBe("replace");
    expect(errorsItem?.category).toBe("patch-safe");
    expect(errorsItem?.conflict).toBe(false);

    const authItem = plan.items.find((item) => item.relativePath === "src/lib/auth/session.ts");
    expect(authItem?.action).toBe("manual-review");
    expect(authItem?.category).toBe("security-critical");
    expect(authItem?.conflict).toBe(true);

    const schemaItem = plan.items.find(
      (item) => item.relativePath === "src/lib/api/contracts/schema.ts"
    );
    expect(schemaItem?.action).toBe("regenerate");
    expect(schemaItem?.ownershipChannel).toBe("generated-artifact");

    const independentItem = plan.items.find(
      (item) => item.relativePath === "src/lib/application/authz.ts"
    );
    expect(independentItem?.action).toBe("manual-review");
    expect(independentItem?.ownershipChannel).toBe("consumer-owned-source");

    expect(plan.items.some((item) => item.relativePath === "src/features/billing/index.ts")).toBe(
      false
    );
    expect(plan.hasBlockingConflicts).toBe(true);
    expect(plan.summary.securityCritical).toBeGreaterThanOrEqual(1);
  });

  it("applies only safe synced-path replacements without touching customized auth", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-upgrade-apply-"));
    const applicationRoot = path.join(tempRoot, "apps/web");

    const consumerFiles = {
      ...SOURCE_V010,
      "src/lib/auth/session.ts": CONSUMER_CUSTOM_AUTH,
    };

    writeConsumerTree(applicationRoot, consumerFiles);

    const plan = planUpgrade({
      applicationRoot: "apps/web",
      baselineAtlasVersion: "0.1.0",
      targetAtlasVersion: "0.2.0",
      baselineChecksums: buildBaselineChecksums(SOURCE_V010),
      syncedPaths: REHEARSAL_MANIFEST.syncedPaths,
      generatedPaths: REHEARSAL_MANIFEST.generatedPaths,
      independentPaths: REHEARSAL_MANIFEST.independentPaths,
      sourceSnapshot: {
        syncedPaths: SOURCE_V010,
        generatedPaths: {
          "src/lib/api/contracts/schema.ts": SOURCE_V010["src/lib/api/contracts/schema.ts"]!,
        },
      },
      targetSnapshot: {
        syncedPaths: TARGET_V020,
        generatedPaths: {
          "src/lib/api/contracts/schema.ts": TARGET_V020["src/lib/api/contracts/schema.ts"]!,
        },
      },
      consumerFiles,
    });

    const result = applySafeUpgradeReplacements({
      applicationRoot,
      plan,
      targetSnapshot: TARGET_V020,
    });

    expect(result.applied.map((item) => item.relativePath)).toEqual(["src/lib/api/errors.ts"]);
    expect(readFileSync(path.join(applicationRoot, "src/lib/api/errors.ts"), "utf8")).toContain(
      "fixed"
    );
    expect(readFileSync(path.join(applicationRoot, "src/lib/auth/session.ts"), "utf8")).toBe(
      CONSUMER_CUSTOM_AUTH
    );

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("detects consumer modification via baseline checksum comparison", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-upgrade-detect-"));
    const applicationRoot = path.join(tempRoot, "apps/web");
    writeConsumerTree(applicationRoot, {
      "src/lib/auth/session.ts": CONSUMER_CUSTOM_AUTH,
    });

    const baseline = buildPlatformBaseline({
      atlasVersion: "0.1.0",
      contractSchemaVersion: 1,
      templateManifestSchemaVersion: 1,
      syncedPathChecksums: {
        "src/lib/auth/session.ts": computeBaselineChecksum(SOURCE_V010["src/lib/auth/session.ts"]!),
      },
    });

    expect(
      hasConsumerModifiedSyncedPath({
        relativePath: "src/lib/auth/session.ts",
        consumerApplicationRoot: applicationRoot,
        baselineChecksums: baseline.syncedPathChecksums,
      })
    ).toBe(true);

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("loads static fixture snapshots for documentation and regression evidence", () => {
    const snapshotPath = path.join(FIXTURE_ROOT, "README.md");
    expect(readFileSync(snapshotPath, "utf8")).toContain("Upgrade rehearsal");
  });
});
