import { existsSync, realpathSync, rmSync, statSync } from "node:fs";
import path from "node:path";

import { extractStaticModuleSpecifiers, packageRootFromSpecifier } from "../doctor/static-imports";
import { CLI_PACKAGE_NAME, readCliAtlasVersion } from "../version";
import {
  FORBIDDEN_BOOTSTRAP_EXACT_PATHS,
  FORBIDDEN_BOOTSTRAP_PATH_PREFIXES,
  REQUIRED_BOOTSTRAP_FILE_PATHS,
  REQUIRED_PACKED_PATHS,
  collectRuntimeAtlasDependencies,
  collectWorkspaceProtocolLeaks,
  createCleanRoomDirectory,
  createPackDestination,
  expectCommandSuccess,
  extractTarballJsFiles,
  findPackedTarball,
  isPackedPathForbidden,
  listPackedBootstrapFiles,
  listTarballEntries,
  packedBootstrapFilePath,
  readPackedManifest,
  readTarballFile,
  runCommand,
} from "./helpers/pack-artifact";
import { getRepoRoot } from "./helpers/run-cli";
import type { PackagedBootstrapManifest } from "../bootstrap/schema";

const PACKAGE_ROOT = path.resolve(__dirname, "../..");
const PACK_TIMEOUT_MS = 180_000;

function runInstalledAtlas(cleanRoom: string, args: string[], cwd = cleanRoom) {
  const bin = path.join(cleanRoom, "node_modules", ".bin", "atlas");
  return runCommand(bin, args, { cwd });
}

function readPackedBootstrapManifest(tarballPath: string): PackagedBootstrapManifest {
  return JSON.parse(
    readTarballFile(tarballPath, "package/assets/bootstrap/manifest.json")
  ) as PackagedBootstrapManifest;
}

describe("Atlas CLI pack and clean-room install", () => {
  const repoRoot = getRepoRoot();
  const cliVersion = readCliAtlasVersion();
  let tarballPath: string | undefined;
  let packDestination: string | undefined;
  let cleanRoom: string | undefined;
  let packedEntries: string[] = [];

  beforeAll(() => {
    packDestination = createPackDestination();
    // Pack the already-built dist. Do not invoke a rebuild here: `pnpm pack` with a
    // `prepack` rebuild would delete dist/ while other Jest workers spawn the CLI.
    expectCommandSuccess("pnpm", ["pack", "--pack-destination", packDestination], {
      cwd: PACKAGE_ROOT,
    });
    tarballPath = findPackedTarball(packDestination);
    packedEntries = listTarballEntries(tarballPath);
  }, PACK_TIMEOUT_MS);

  afterAll(() => {
    if (packDestination) {
      rmSync(packDestination, { recursive: true, force: true });
    }
    if (cleanRoom) {
      rmSync(cleanRoom, { recursive: true, force: true });
    }
  });

  it("packs the required executable surface and excludes repository-only files", () => {
    expect(tarballPath).toBeDefined();
    expect(packedEntries.length).toBeGreaterThan(0);

    for (const required of REQUIRED_PACKED_PATHS) {
      expect(packedEntries).toContain(required);
    }

    const forbidden = packedEntries
      .map((entry) => {
        const reason = isPackedPathForbidden(entry);
        return reason ? `${reason}: ${entry}` : undefined;
      })
      .filter((entry): entry is string => entry !== undefined);

    expect(forbidden).toEqual([]);
  });

  it("packs the bootstrap manifest and a manifest-driven asset tree", () => {
    expect(tarballPath).toBeDefined();
    const manifest = readPackedBootstrapManifest(tarballPath as string);
    const bootstrapFiles = listPackedBootstrapFiles(packedEntries);

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.atlasVersion).toBe(cliVersion);
    expect(manifest.entries.length).toBeGreaterThan(0);
    expect(bootstrapFiles.sort()).toEqual(
      manifest.entries.map((entry) => entry.destination).sort()
    );

    for (const required of REQUIRED_BOOTSTRAP_FILE_PATHS) {
      expect(packedEntries).toContain(packedBootstrapFilePath(required));
      expect(manifest.entries.some((entry) => entry.destination === required)).toBe(true);
    }

    const forbiddenExact = bootstrapFiles.filter((file) =>
      (FORBIDDEN_BOOTSTRAP_EXACT_PATHS as readonly string[]).includes(file)
    );
    const forbiddenPrefixed = bootstrapFiles.filter((file) =>
      FORBIDDEN_BOOTSTRAP_PATH_PREFIXES.some((prefix) => file.startsWith(prefix))
    );

    expect(forbiddenExact).toEqual([]);
    expect(forbiddenPrefixed).toEqual([]);

    const uiPackage = JSON.parse(
      readTarballFile(tarballPath as string, packedBootstrapFilePath("packages/ui/package.json"))
    ) as { scripts?: Record<string, string>; devDependencies?: Record<string, string> };
    expect(uiPackage.scripts?.storybook).toBeUndefined();
    expect(uiPackage.scripts?.["test:visual"]).toBeUndefined();
    expect(uiPackage.scripts?.prepare).toBeUndefined();
    expect(uiPackage.devDependencies?.["@playwright/test"]).toBeUndefined();
    expect(uiPackage.devDependencies?.storybook).toBeUndefined();
    expect(uiPackage.devDependencies?.husky).toBeUndefined();
    expect(uiPackage.scripts?.test).toBeDefined();

    const lighthouseConfig = readTarballFile(
      tarballPath as string,
      packedBootstrapFilePath("lighthouserc.json")
    );
    expect(lighthouseConfig).toContain("ci");
    const webPackage = JSON.parse(
      readTarballFile(tarballPath as string, packedBootstrapFilePath("apps/web/package.json"))
    ) as { scripts?: Record<string, string> };
    expect(webPackage.scripts?.["perf:lhci"]).toContain("../../lighthouserc.json");
  });

  it("does not leak workspace protocol or unpublished Atlas runtime dependencies", () => {
    expect(tarballPath).toBeDefined();
    const manifest = readPackedManifest(tarballPath as string);

    expect(manifest.name).toBe(CLI_PACKAGE_NAME);
    expect(manifest.version).toBe(cliVersion);
    expect(manifest.bin?.atlas).toBe("./dist/cli.js");
    expect(collectWorkspaceProtocolLeaks(manifest)).toEqual([]);
    expect(collectRuntimeAtlasDependencies(manifest)).toEqual([]);
    expect(manifest.dependencies?.["@atlas/project"]).toBeUndefined();
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual(
      ["minimatch", "typescript", "yaml", "zod"].sort()
    );
  });

  it("does not leave unresolved unpublished Atlas imports in packed runtime JS", () => {
    expect(tarballPath).toBeDefined();
    const jsFiles = extractTarballJsFiles(tarballPath as string).filter((file) =>
      file.path.startsWith("package/dist/")
    );
    expect(jsFiles.map((file) => file.path).sort()).toEqual(
      [
        "package/dist/bootstrap-assets.js",
        "package/dist/cli.js",
        "package/dist/dependency-validation.js",
        "package/dist/index.js",
      ].sort()
    );

    const leaks: string[] = [];
    for (const file of jsFiles) {
      const specifiers = extractStaticModuleSpecifiers(file.path, file.content);
      for (const specifier of specifiers) {
        const packageName = packageRootFromSpecifier(specifier.specifier);
        if (packageName?.startsWith("@atlas/")) {
          leaks.push(`${file.path}:${specifier.line} ${specifier.specifier}`);
        }
      }
    }

    expect(leaks).toEqual([]);

    const cliJs = jsFiles.find((file) => file.path === "package/dist/cli.js");
    expect(cliJs?.content.startsWith("#!/usr/bin/env node\n")).toBe(true);
    expect(cliJs?.content.startsWith("#!/usr/bin/env node\n#!/usr/bin/env node")).toBe(false);
  });

  it(
    "installs the tarball outside the repository and runs the packed atlas binary",
    () => {
      expect(tarballPath).toBeDefined();
      cleanRoom = createCleanRoomDirectory(repoRoot);

      expectCommandSuccess("pnpm", ["add", tarballPath as string], {
        cwd: cleanRoom,
      });

      const bin = path.join(cleanRoom, "node_modules", ".bin", "atlas");
      expect(existsSync(bin)).toBe(true);
      expect(statSync(bin).mode & 0o111).not.toBe(0);

      const installedPackage = path.join(cleanRoom, "node_modules", "@atlas", "cli");
      expect(existsSync(installedPackage)).toBe(true);
      expect(realpathSync(installedPackage)).not.toBe(realpathSync(PACKAGE_ROOT));
      expect(realpathSync(bin).startsWith(realpathSync(PACKAGE_ROOT) + path.sep)).toBe(false);

      const help = runInstalledAtlas(cleanRoom, ["--help"]);
      expect(help.status).toBe(0);
      expect(help.stdout).toContain("Atlas CLI");
      expect(help.stdout).toContain("generate");

      const version = runInstalledAtlas(cleanRoom, ["--version"]);
      expect(version.status).toBe(0);
      expect(version.stdout.trim()).toBe(cliVersion);
      expect(version.stdout.trim()).not.toBe("0.0.0");

      const generateHelp = runInstalledAtlas(cleanRoom, ["generate", "--help"]);
      expect(generateHelp.status).toBe(0);
      expect(generateHelp.stdout).toContain("atlas generate");

      const generateList = runInstalledAtlas(cleanRoom, ["generate", "list"]);
      expect(generateList.status).toBe(0);
      expect(generateList.stdout).toContain("feature");
      expect(generateList.stdout).toContain("page");

      const resolverPath = path.join(installedPackage, "dist", "bootstrap-assets.js");
      expect(existsSync(resolverPath)).toBe(true);

      const installedLookup = runCommand(
        process.execPath,
        [
          "-e",
          `
const path = require("path");
const resolver = require(${JSON.stringify(resolverPath)});
const root = resolver.findBootstrapAssetRoot();
const manifest = resolver.readBootstrapManifest(root);
const web = resolver.resolveBootstrapAsset("apps/web/package.json", root);
const ui = resolver.resolveBootstrapAsset("packages/ui/package.json", root);
const consent = resolver.resolveBootstrapAsset("packages/consent/package.json", root);
const config = resolver.resolveBootstrapAsset("packages/config/package.json", root);
const workspace = resolver.resolveBootstrapAsset("pnpm-workspace.yaml", root);
process.stdout.write(JSON.stringify({
  root,
  atlasVersion: manifest.atlasVersion,
  entryCount: manifest.entries.length,
  destinations: {
    web: web.absolutePath,
    ui: ui.absolutePath,
    consent: consent.absolutePath,
    config: config.absolutePath,
    workspace: workspace.absolutePath
  }
}));
`,
        ],
        { cwd: repoRoot }
      );
      expect(installedLookup.status).toBe(0);
      const resolved = JSON.parse(installedLookup.stdout) as {
        root: string;
        atlasVersion: string;
        entryCount: number;
        destinations: Record<string, string>;
      };

      const installedRoot = realpathSync(installedPackage);
      const repoReal = realpathSync(repoRoot);
      expect(resolved.atlasVersion).toBe(cliVersion);
      expect(resolved.entryCount).toBeGreaterThan(0);
      expect(realpathSync(resolved.root).startsWith(installedRoot)).toBe(true);
      expect(realpathSync(resolved.root).startsWith(`${repoReal}${path.sep}`)).toBe(false);

      for (const absolutePath of Object.values(resolved.destinations)) {
        expect(existsSync(absolutePath)).toBe(true);
        expect(realpathSync(absolutePath).startsWith(installedRoot)).toBe(true);
        expect(realpathSync(absolutePath).startsWith(`${repoReal}${path.sep}`)).toBe(false);
      }
    },
    PACK_TIMEOUT_MS
  );
});
