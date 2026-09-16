import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { CliErrorCode } from "../errors/cli-error";
import { loadReleaseSnapshot } from "../upgrade/release-snapshot";

function writeSnapshot(tempRoot: string, manifest: Record<string, unknown>): void {
  const releaseRoot = path.join(tempRoot, "releases", "0.9.9");
  mkdirSync(path.join(releaseRoot, "apps/web/src/lib/api"), { recursive: true });
  mkdirSync(path.join(releaseRoot, "openapi"), { recursive: true });
  writeFileSync(
    path.join(releaseRoot, "release.snapshot.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  writeFileSync(
    path.join(releaseRoot, "apps/web/src/lib/api/client.ts"),
    "export const api = true;\n"
  );
  writeFileSync(path.join(releaseRoot, "openapi/openapi.json"), '{"openapi":"3.0.0"}');
}

describe("release snapshot path safety", () => {
  it("rejects absolute POSIX paths", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-release-safety-"));
    writeSnapshot(tempRoot, {
      schemaVersion: 1,
      atlasVersion: "0.9.9",
      contractSchemaVersion: 1,
      templateManifestSchemaVersion: 1,
      canonicalApplication: "apps/web",
      syncedPaths: ["/etc/passwd"],
      generatedPaths: [],
      independentPaths: [],
      packageVersions: {},
      openApiSpecRelativePath: "openapi/openapi.json",
    });

    expect(() =>
      loadReleaseSnapshot({
        atlasVersion: "0.9.9",
        releasesDir: path.join(tempRoot, "releases"),
      })
    ).toThrow(expect.objectContaining({ code: CliErrorCode.UPGRADE_PREREQUISITE }));
  });

  it("rejects path traversal segments", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-release-safety-"));
    writeSnapshot(tempRoot, {
      schemaVersion: 1,
      atlasVersion: "0.9.9",
      contractSchemaVersion: 1,
      templateManifestSchemaVersion: 1,
      canonicalApplication: "apps/web",
      syncedPaths: ["../escape.ts"],
      generatedPaths: [],
      independentPaths: [],
      packageVersions: {},
      openApiSpecRelativePath: "openapi/openapi.json",
    });

    expect(() =>
      loadReleaseSnapshot({
        atlasVersion: "0.9.9",
        releasesDir: path.join(tempRoot, "releases"),
      })
    ).toThrow(expect.objectContaining({ code: CliErrorCode.UPGRADE_PREREQUISITE }));
  });

  it("rejects duplicate synced paths", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-release-safety-"));
    writeSnapshot(tempRoot, {
      schemaVersion: 1,
      atlasVersion: "0.9.9",
      contractSchemaVersion: 1,
      templateManifestSchemaVersion: 1,
      canonicalApplication: "apps/web",
      syncedPaths: ["src/lib/api/client.ts", "src/lib/api/client.ts"],
      generatedPaths: [],
      independentPaths: [],
      packageVersions: {},
      openApiSpecRelativePath: "openapi/openapi.json",
    });

    expect(() =>
      loadReleaseSnapshot({
        atlasVersion: "0.9.9",
        releasesDir: path.join(tempRoot, "releases"),
      })
    ).toThrow(expect.objectContaining({ code: CliErrorCode.UPGRADE_PREREQUISITE }));
  });

  it("rejects ownership overlap between synced and generated paths", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-release-safety-"));
    writeSnapshot(tempRoot, {
      schemaVersion: 1,
      atlasVersion: "0.9.9",
      contractSchemaVersion: 1,
      templateManifestSchemaVersion: 1,
      canonicalApplication: "apps/web",
      syncedPaths: ["src/lib/api/client.ts"],
      generatedPaths: ["src/lib/api/client.ts"],
      independentPaths: [],
      packageVersions: {},
      openApiSpecRelativePath: "openapi/openapi.json",
    });

    expect(() =>
      loadReleaseSnapshot({
        atlasVersion: "0.9.9",
        releasesDir: path.join(tempRoot, "releases"),
      })
    ).toThrow(expect.objectContaining({ code: CliErrorCode.UPGRADE_PREREQUISITE }));
  });
});
