import { spawnSync, type SpawnSyncOptions } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface CommandResult {
  stdout: string;
  stderr: string;
  status: number | null;
}

export interface PackedManifest {
  name?: string;
  version?: string;
  bin?: Record<string, string>;
  files?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  bundleDependencies?: string[];
  bundledDependencies?: string[];
}

export const REQUIRED_PACKED_PATHS = [
  "package/package.json",
  "package/dist/cli.js",
  "package/dist/index.js",
  "package/dist/dependency-validation.js",
  "package/dist/bootstrap-assets.js",
  "package/LICENSE",
  "package/assets/bootstrap/manifest.json",
] as const;

export const REQUIRED_BOOTSTRAP_FILE_PATHS = [
  "apps/web/package.json",
  "packages/ui/package.json",
  "packages/consent/package.json",
  "packages/config/package.json",
  "pnpm-workspace.yaml",
  "lighthouserc.json",
] as const;

export const FORBIDDEN_BOOTSTRAP_PATH_PREFIXES = [
  "apps/reference/",
  "packages/cli/",
  "packages/project/",
  ".github/",
  "releases/",
  "packages/ui/.storybook/",
  "packages/ui/visual-tests/",
  "packages/ui/.husky/",
  "packages/ui/scripts/",
] as const;

export const FORBIDDEN_BOOTSTRAP_EXACT_PATHS = [
  "atlas.config.json",
  "pnpm-lock.yaml",
  "package.json",
  "packages/ui/playwright.storybook.config.ts",
  "packages/ui/playwright.visual.config.ts",
] as const;

function isPackedCliNoisePath(entry: string): boolean {
  return (
    entry.startsWith("package/") &&
    !entry.startsWith("package/assets/") &&
    !entry.startsWith("package/dist/")
  );
}

export const FORBIDDEN_PACKED_PATH_PATTERNS: { id: string; test: (entry: string) => boolean }[] = [
  { id: "src", test: (entry) => entry === "package/src" || entry.startsWith("package/src/") },
  {
    id: "jest-config",
    test: (entry) => isPackedCliNoisePath(entry) && /\/jest\.config\.[^/]+$/.test(entry),
  },
  {
    id: "eslint-config",
    test: (entry) => isPackedCliNoisePath(entry) && /\/eslint\.config\.[^/]+$/.test(entry),
  },
  { id: "tests", test: (entry) => isPackedCliNoisePath(entry) && entry.includes("/__tests__/") },
  { id: "coverage", test: (entry) => entry.includes("/coverage/") },
  { id: "turbo", test: (entry) => entry.includes("/.turbo/") },
  { id: "node-modules", test: (entry) => entry.includes("/node_modules/") },
  { id: "scripts", test: (entry) => entry.startsWith("package/scripts/") },
];

export function packedBootstrapFilePath(destination: string): string {
  return `package/assets/bootstrap/files/${destination}`;
}

export function listPackedBootstrapFiles(entries: string[]): string[] {
  const prefix = "package/assets/bootstrap/files/";
  return entries
    .filter((entry) => entry.startsWith(prefix) && !entry.endsWith("/"))
    .map((entry) => entry.slice(prefix.length));
}

const RUNTIME_DEPENDENCY_SECTIONS = [
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

export function runCommand(
  command: string,
  args: string[],
  options: SpawnSyncOptions = {}
): CommandResult {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    ...options,
    env: {
      ...process.env,
      NO_COLOR: "1",
      FORCE_COLOR: "0",
      ...(options.env ?? {}),
    },
  });

  if (result.error) {
    throw result.error;
  }

  return {
    stdout: bufferToString(result.stdout),
    stderr: bufferToString(result.stderr),
    status: result.status,
  };
}

function bufferToString(value: string | Buffer | null | undefined): string {
  if (value == null) {
    return "";
  }
  return typeof value === "string" ? value : value.toString("utf8");
}

export function expectCommandSuccess(
  command: string,
  args: string[],
  options: SpawnSyncOptions = {}
): CommandResult {
  const result = runCommand(command, args, options);
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed (${result.status})\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
  }
  return result;
}

export function listTarballEntries(tarballPath: string): string[] {
  const result = expectCommandSuccess("tar", ["-tzf", tarballPath]);
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function readTarballFile(tarballPath: string, entry: string): string {
  return expectCommandSuccess("tar", ["-xOf", tarballPath, entry]).stdout;
}

export function readPackedManifest(tarballPath: string): PackedManifest {
  return JSON.parse(readTarballFile(tarballPath, "package/package.json")) as PackedManifest;
}

export function collectWorkspaceProtocolLeaks(manifest: PackedManifest): string[] {
  const leaks: string[] = [];
  const sections = {
    dependencies: manifest.dependencies,
    devDependencies: manifest.devDependencies,
    optionalDependencies: manifest.optionalDependencies,
    peerDependencies: manifest.peerDependencies,
  } as const;

  for (const [section, deps] of Object.entries(sections)) {
    for (const [name, range] of Object.entries(deps ?? {})) {
      if (typeof range === "string" && range.includes("workspace:")) {
        leaks.push(`${section} ${name}: ${range}`);
      }
    }
  }

  return leaks;
}

export function collectRuntimeAtlasDependencies(manifest: PackedManifest): string[] {
  const found: string[] = [];

  for (const section of RUNTIME_DEPENDENCY_SECTIONS) {
    for (const name of Object.keys(manifest[section] ?? {})) {
      if (name.startsWith("@atlas/")) {
        found.push(`${section} ${name}`);
      }
    }
  }

  return found;
}

export function isPackedPathForbidden(entry: string): string | undefined {
  return FORBIDDEN_PACKED_PATH_PATTERNS.find((pattern) => pattern.test(entry))?.id;
}

export function createCleanRoomDirectory(repoRoot: string): string {
  const cleanRoom = mkdtempSync(path.join(os.tmpdir(), "atlas-cli-clean-room-"));
  const resolvedCleanRoom = path.resolve(cleanRoom);
  const resolvedRepoRoot = path.resolve(repoRoot);
  const insideRepo =
    resolvedCleanRoom === resolvedRepoRoot ||
    resolvedCleanRoom.startsWith(`${resolvedRepoRoot}${path.sep}`);

  if (insideRepo) {
    rmSync(cleanRoom, { recursive: true, force: true });
    throw new Error(
      `Clean-room directory must be outside the Atlas repository (${resolvedCleanRoom})`
    );
  }

  writeFileSync(
    path.join(cleanRoom, "package.json"),
    `${JSON.stringify(
      {
        name: "atlas-cli-clean-room",
        private: true,
        version: "0.0.0",
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return cleanRoom;
}

export function extractTarballJsFiles(tarballPath: string): { path: string; content: string }[] {
  const extractRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-cli-pack-extract-"));
  expectCommandSuccess("tar", ["-xzf", tarballPath, "-C", extractRoot]);

  const files: { path: string; content: string }[] = [];

  function walk(current: string, relative: string): void {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(absolutePath, childRelative);
        continue;
      }
      if (entry.name.endsWith(".js") && !entry.name.endsWith(".map.js")) {
        files.push({
          path: childRelative,
          content: readFileSync(absolutePath, "utf8"),
        });
      }
    }
  }

  walk(extractRoot, "");
  rmSync(extractRoot, { recursive: true, force: true });
  return files;
}

export function createPackDestination(): string {
  return mkdtempSync(path.join(os.tmpdir(), "atlas-cli-pack-out-"));
}

export function findPackedTarball(packDestination: string): string {
  const names = readdirSync(packDestination).filter((name) => name.endsWith(".tgz"));
  if (names.length !== 1 || names[0] === undefined) {
    throw new Error(
      `Expected exactly one tarball in ${packDestination}, found: ${names.join(", ")}`
    );
  }

  return path.join(packDestination, names[0]);
}
