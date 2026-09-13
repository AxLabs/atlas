import { existsSync, realpathSync, rmSync, statSync } from "node:fs";
import path from "node:path";

import { extractStaticModuleSpecifiers, packageRootFromSpecifier } from "../doctor/static-imports";
import { CLI_PACKAGE_NAME, readCliAtlasVersion } from "../version";
import {
  REQUIRED_PACKED_PATHS,
  collectRuntimeAtlasDependencies,
  collectWorkspaceProtocolLeaks,
  createCleanRoomDirectory,
  createPackDestination,
  expectCommandSuccess,
  extractTarballJsFiles,
  findPackedTarball,
  isPackedPathForbidden,
  listTarballEntries,
  readPackedManifest,
  runCommand,
} from "./helpers/pack-artifact";
import { getRepoRoot } from "./helpers/run-cli";

const PACKAGE_ROOT = path.resolve(__dirname, "../..");
const PACK_TIMEOUT_MS = 180_000;

function runInstalledAtlas(cleanRoom: string, args: string[], cwd = cleanRoom) {
  const bin = path.join(cleanRoom, "node_modules", ".bin", "atlas");
  return runCommand(bin, args, { cwd });
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
    const jsFiles = extractTarballJsFiles(tarballPath as string);
    expect(jsFiles.map((file) => file.path).sort()).toEqual(
      [
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
    },
    PACK_TIMEOUT_MS
  );
});
