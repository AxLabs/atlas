import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { getSyncedPathBaselineStatus } from "@atlas/project";

import { CliErrorCode } from "../errors/cli-error";
import { applySafeUpgradeReplacements } from "../upgrade/apply";
import { selectRepositorySyncedPathChecksumsForUpgrade } from "../upgrade/baseline";
import { resolvePathUnderRoot } from "../upgrade/path-safety";
import { generateProductionReleaseSnapshot } from "../upgrade/production-snapshot";
import { loadReleaseSnapshot } from "../upgrade/release-snapshot";

import type { UpgradePlan, UpgradePlanItem } from "../upgrade/types";

const ESCAPE_PATHS = [
  "../outside",
  "../../outside",
  "/tmp/outside",
  "C:\\outside",
  "..\\..\\outside",
  "foo/../../../outside",
  "foo\\..\\..\\outside",
];

const OUTSIDE_CONTENT = "SECRET\n";

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function createEscapeFixture(): { parent: string; repoRoot: string; outsidePath: string } {
  const parent = mkdtempSync(path.join(os.tmpdir(), "atlas-repo-escape-"));
  const repoRoot = path.join(parent, "repo");
  mkdirSync(path.join(repoRoot, "apps/web"), { recursive: true });
  writeFileSync(path.join(repoRoot, "Dockerfile"), "FROM alpine\n");
  const outsidePath = path.join(parent, "outside");
  writeFileSync(outsidePath, OUTSIDE_CONTENT);
  return { parent, repoRoot, outsidePath };
}

function repositoryPlan(item: UpgradePlanItem): UpgradePlan {
  return {
    sourceAtlasVersion: "1.2.0",
    targetAtlasVersion: "1.2.1",
    applicationRoot: "apps/web",
    items: [item],
    summary: {
      patchSafe: 1,
      mergeRequired: 0,
      migrationRequired: 0,
      manual: 0,
      securityCritical: 0,
      skipped: 0,
      packageUpdates: 0,
      regenerations: 0,
      replacements: item.action === "replace" || item.action === "create" ? 1 : 0,
    },
    hasBlockingConflicts: false,
    hasIncompleteMigrations: false,
  };
}

function repositoryItem(relativePath: string, action: UpgradePlanItem["action"]): UpgradePlanItem {
  return {
    relativePath,
    ownershipChannel: "atlas-managed-template",
    category: "patch-safe",
    action,
    message: "test",
    conflict: false,
    pathScope: "repository",
  };
}

describe("repositorySyncedPaths filesystem containment", () => {
  it.each(ESCAPE_PATHS)("rejects %s at the contained join boundary", (relativePath) => {
    const { parent, repoRoot, outsidePath } = createEscapeFixture();

    expect(() => resolvePathUnderRoot(repoRoot, relativePath, "repository path")).toThrow(
      expect.objectContaining({ code: CliErrorCode.UPGRADE_PREREQUISITE })
    );

    expect(readFileSync(outsidePath, "utf8")).toBe(OUTSIDE_CONTENT);
    rmSync(parent, { recursive: true, force: true });
  });

  it.each(ESCAPE_PATHS)(
    "does not overwrite files outside the repository root for %s",
    (relativePath) => {
      const { parent, repoRoot, outsidePath } = createEscapeFixture();

      expect(() =>
        applySafeUpgradeReplacements({
          applicationRoot: path.join(repoRoot, "apps/web"),
          repoRoot,
          plan: repositoryPlan(repositoryItem(relativePath, "replace")),
          targetSnapshot: { [relativePath]: "PWNED\n" },
        })
      ).toThrow();

      expect(readFileSync(outsidePath, "utf8")).toBe(OUTSIDE_CONTENT);
      rmSync(parent, { recursive: true, force: true });
    }
  );

  it.each(ESCAPE_PATHS)(
    "does not remove files outside the repository root for %s",
    (relativePath) => {
      const { parent, repoRoot, outsidePath } = createEscapeFixture();

      expect(() =>
        applySafeUpgradeReplacements({
          applicationRoot: path.join(repoRoot, "apps/web"),
          repoRoot,
          plan: repositoryPlan(repositoryItem(relativePath, "remove")),
          targetSnapshot: {},
        })
      ).toThrow();

      expect(readFileSync(outsidePath, "utf8")).toBe(OUTSIDE_CONTENT);
      rmSync(parent, { recursive: true, force: true });
    }
  );

  it.each(ESCAPE_PATHS)(
    "does not checksum files outside the repository root during upgrade baseline capture for %s",
    (relativePath) => {
      const { parent, repoRoot, outsidePath } = createEscapeFixture();

      expect(() =>
        selectRepositorySyncedPathChecksumsForUpgrade({
          repoRoot,
          targetRepositorySyncedPaths: [relativePath],
          previousChecksums: {},
          items: [repositoryItem(relativePath, "replace")],
          consumerFiles: {},
          targetContents: { [relativePath]: "PWNED\n" },
        })
      ).toThrow();

      expect(readFileSync(outsidePath, "utf8")).toBe(OUTSIDE_CONTENT);
      rmSync(parent, { recursive: true, force: true });
    }
  );

  it.each(ESCAPE_PATHS)(
    "does not read files outside the root when comparing baseline checksums for %s",
    (relativePath) => {
      const { parent, repoRoot, outsidePath } = createEscapeFixture();

      expect(() =>
        getSyncedPathBaselineStatus({
          relativePath,
          consumerApplicationRoot: repoRoot,
          baselineChecksums: { [relativePath]: "sha256:" + "a".repeat(64) },
        })
      ).toThrow();

      expect(readFileSync(outsidePath, "utf8")).toBe(OUTSIDE_CONTENT);
      rmSync(parent, { recursive: true, force: true });
    }
  );

  it("does not read escaped repositorySyncedPaths from a release snapshot", () => {
    const { parent, outsidePath } = createEscapeFixture();
    const releasesDir = path.join(parent, "releases");
    const releaseRoot = path.join(releasesDir, "1.2.1");
    mkdirSync(path.join(releaseRoot, "apps/web/src/lib/api"), { recursive: true });
    mkdirSync(path.join(releaseRoot, "openapi"), { recursive: true });
    writeFileSync(
      path.join(releaseRoot, "apps/web/src/lib/api/client.ts"),
      "export const api = true;\n"
    );
    writeFileSync(path.join(releaseRoot, "openapi/openapi.json"), '{"openapi":"3.0.0"}');

    for (const relativePath of ["../outside", "..\\..\\outside", "/tmp/outside", "C:\\outside"]) {
      writeJson(path.join(releaseRoot, "release.snapshot.json"), {
        schemaVersion: 1,
        atlasVersion: "1.2.1",
        contractSchemaVersion: 1,
        templateManifestSchemaVersion: 1,
        canonicalApplication: "apps/web",
        syncedPaths: ["src/lib/api/client.ts"],
        generatedPaths: [],
        independentPaths: [],
        repositorySyncedPaths: [relativePath],
        packageVersions: {},
        openApiSpecRelativePath: "openapi/openapi.json",
      });

      expect(() =>
        loadReleaseSnapshot({
          atlasVersion: "1.2.1",
          releasesDir,
        })
      ).toThrow(expect.objectContaining({ code: CliErrorCode.UPGRADE_PREREQUISITE }));
    }

    expect(readFileSync(outsidePath, "utf8")).toBe(OUTSIDE_CONTENT);
    rmSync(parent, { recursive: true, force: true });
  });

  it("does not copy escaped repositorySyncedPaths into a production snapshot", () => {
    const { parent, repoRoot, outsidePath } = createEscapeFixture();
    writeJson(path.join(repoRoot, "package.json"), {
      name: "@atlas/monorepo",
      version: "1.2.1",
      private: true,
    });
    writeJson(path.join(repoRoot, "atlas.config.json"), { schemaVersion: 1 });
    writeJson(path.join(repoRoot, "templates/app-infrastructure.manifest.json"), {
      schemaVersion: 1,
      canonicalApplication: "apps/web",
      consumerApplications: ["apps/reference"],
      syncedPaths: ["src/lib/api/errors.ts"],
      generatedPaths: [],
      independentPaths: {},
      referenceOnlyPaths: [],
      starterOnlyPaths: [],
      repositorySyncedPaths: ["../outside"],
    });
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
      writeJson(path.join(repoRoot, relative), {
        name,
        version: "1.2.1",
        private: name !== "@blitzcraftlabs/atlas",
      });
    }
    mkdirSync(path.join(repoRoot, "apps/web/src/lib/api"), { recursive: true });
    writeFileSync(
      path.join(repoRoot, "apps/web/src/lib/api/errors.ts"),
      "export const errors = true;\n"
    );
    const outputDir = path.join(parent, "snapshot");

    expect(() =>
      generateProductionReleaseSnapshot({
        repoRoot,
        outputDir,
        replace: true,
      })
    ).toThrow();

    expect(readFileSync(outsidePath, "utf8")).toBe(OUTSIDE_CONTENT);
    rmSync(parent, { recursive: true, force: true });
  });
});
