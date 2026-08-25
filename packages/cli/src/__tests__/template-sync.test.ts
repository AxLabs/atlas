import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { compareAppInfrastructureManifest } from "../template-sync/compare";
import { loadAppInfrastructureManifest } from "../template-sync/manifest";
import { planTemplateSyncActions, applyTemplateSyncActions } from "../template-sync/sync";

describe("template infrastructure sync", () => {
  const repoRoot = path.resolve(__dirname, "../../../../");
  const manifest = loadAppInfrastructureManifest(repoRoot);

  it("loads the repository manifest", () => {
    expect(manifest.canonicalApplication).toBe("apps/web");
    expect(manifest.consumerApplications).toContain("apps/reference");
    expect(manifest.syncedPaths.length).toBeGreaterThan(0);
  });

  it("reports no drift on the healthy checkout", () => {
    const comparison = compareAppInfrastructureManifest(repoRoot, manifest);
    expect(comparison.drifts).toEqual([]);
    expect(comparison.structuralIssues).toEqual([]);
  });

  it("detects content drift in a temporary fixture", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-template-sync-"));
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
      "export const consumer = true;\n"
    );

    const fixtureManifest = {
      ...manifest,
      syncedPaths: ["src/lib/api/client.ts"],
      independentPaths: {},
      referenceOnlyPaths: [],
      starterOnlyPaths: [],
      structuralConformance: { requiredInfrastructureModules: [] },
    };

    const comparison = compareAppInfrastructureManifest(tempRoot, fixtureManifest);
    expect(comparison.drifts).toHaveLength(1);
    expect(comparison.drifts[0]?.kind).toBe("content-drift");

    const actions = planTemplateSyncActions(tempRoot, fixtureManifest, comparison.drifts);
    expect(actions).toHaveLength(1);
    applyTemplateSyncActions(tempRoot, actions, false);
    expect(readFileSync(path.join(consumerRoot, "src/lib/api/client.ts"), "utf8")).toContain(
      "canonical"
    );

    rmSync(tempRoot, { recursive: true, force: true });
  });
});
