import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { generateProductionReleaseSnapshot } from "../upgrade/production-snapshot";
import { loadReleaseSnapshot } from "../upgrade/release-snapshot";

function writeMiniAtlasTree(root: string, version: string): void {
  writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "@atlas/monorepo", version, private: true }, null, 2)}\n`
  );
  writeFileSync(
    path.join(root, "atlas.config.json"),
    `${JSON.stringify({ schemaVersion: 1 }, null, 2)}\n`
  );
  mkdirSync(path.join(root, "templates"), { recursive: true });
  writeFileSync(
    path.join(root, "templates/app-infrastructure.manifest.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        canonicalApplication: "apps/web",
        consumerApplications: ["apps/reference"],
        syncedPaths: ["src/lib/api/errors.ts"],
        generatedPaths: ["src/lib/api/contracts/schema.ts"],
        independentPaths: {
          "apps/reference": {
            "src/lib/application/authz.ts": "Consumer-owned wiring",
          },
        },
        referenceOnlyPaths: [],
        starterOnlyPaths: [],
      },
      null,
      2
    )}\n`
  );

  for (const relative of [
    "packages/cli/package.json",
    "packages/ui/package.json",
    "packages/config/package.json",
    "packages/consent/package.json",
    "packages/project/package.json",
  ]) {
    const name =
      relative === "packages/cli/package.json"
        ? "@blitzcraftlabs/atlas"
        : `@atlas/${relative.split("/")[1]}`;
    mkdirSync(path.join(root, path.dirname(relative)), { recursive: true });
    writeFileSync(
      path.join(root, relative),
      `${JSON.stringify({ name, version, private: name !== "@blitzcraftlabs/atlas" }, null, 2)}\n`
    );
  }

  mkdirSync(path.join(root, "apps/web/src/lib/api/contracts"), { recursive: true });
  mkdirSync(path.join(root, "apps/web/src/lib/application"), { recursive: true });
  mkdirSync(path.join(root, "openapi"), { recursive: true });
  writeFileSync(path.join(root, "apps/web/src/lib/api/errors.ts"), "export const errors = true;\n");
  writeFileSync(
    path.join(root, "apps/web/src/lib/api/contracts/schema.ts"),
    "export const schema = true;\n"
  );
  writeFileSync(
    path.join(root, "apps/web/src/lib/application/authz.ts"),
    "export const authz = true;\n"
  );
  writeFileSync(path.join(root, "openapi/openapi.json"), '{"openapi":"3.0.0","paths":{}}\n');
}

describe("production snapshot generation", () => {
  it("is deterministic for the same source tree", () => {
    const repoRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-snapshot-src-"));
    writeMiniAtlasTree(repoRoot, "0.9.0");
    const firstOut = mkdtempSync(path.join(os.tmpdir(), "atlas-snapshot-out-a-"));
    const secondOut = mkdtempSync(path.join(os.tmpdir(), "atlas-snapshot-out-b-"));

    const first = generateProductionReleaseSnapshot({
      repoRoot,
      outputDir: path.join(firstOut, "0.9.0"),
      replace: true,
    });
    const second = generateProductionReleaseSnapshot({
      repoRoot,
      outputDir: path.join(secondOut, "0.9.0"),
      replace: true,
    });

    expect(first.version).toBe("0.9.0");
    expect(first.manifest.syncedPaths).toEqual(["src/lib/api/errors.ts"]);
    expect(first.manifest.independentPaths).toEqual(["src/lib/application/authz.ts"]);
    expect(first.manifest.packageVersions["@blitzcraftlabs/atlas"]).toBe("0.9.0");
    expect(second.manifest).toEqual(first.manifest);
    expect(readFileSync(path.join(firstOut, "0.9.0", "release.snapshot.json"), "utf8")).toBe(
      readFileSync(path.join(secondOut, "0.9.0", "release.snapshot.json"), "utf8")
    );
    expect(
      loadReleaseSnapshot({
        atlasVersion: "0.9.0",
        releasesDir: firstOut,
      }).manifest.atlasVersion
    ).toBe("0.9.0");

    rmSync(repoRoot, { recursive: true, force: true });
    rmSync(firstOut, { recursive: true, force: true });
    rmSync(secondOut, { recursive: true, force: true });
  });
});
