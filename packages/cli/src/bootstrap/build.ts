import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { minimatch } from "minimatch";

import { findCliPackageRoot } from "../version";

import { formatPosixMode, sha256Bytes } from "./checksum";
import {
  ARTIFACT_EXCLUDE_GLOBS,
  BOOTSTRAP_MANIFEST_SCHEMA_VERSION,
  SKIP_DIRECTORY_NAMES,
  SOURCE_BOOTSTRAP_MANIFEST_RELATIVE_PATH,
} from "./constants";
import {
  CONSUMER_UI_PACKAGE_JSON_DESTINATION,
  toConsumerUiPackageManifest,
} from "./consumer-ui-manifest";
import { BootstrapAssetError } from "./errors";
import { verifyPackagedBootstrapTree } from "./integrity";
import {
  assertNoDestinationPrefixConflicts,
  comparePosixPaths,
  joinPosix,
  resolveContainedPath,
} from "./paths";
import {
  packagedBootstrapAssetRoot,
  packagedBootstrapFilesRoot,
  packagedBootstrapManifestPath,
} from "./resolve";
import {
  type PackagedBootstrapManifest,
  type PackagedBootstrapManifestEntry,
  parseSourceBootstrapManifest,
  serializePackagedBootstrapManifest,
  type SourceBootstrapManifest,
  type SourceBootstrapManifestEntry,
} from "./schema";

export interface BuildBootstrapAssetsOptions {
  repoRoot: string;
  packageRoot: string;
  sourceManifestPath?: string;
  outputDir?: string;
}

interface ExpandedFile {
  source: string;
  destination: string;
  absoluteSource: string;
}

function readPackageVersion(packageRoot: string): string {
  const packageJsonPath = path.join(packageRoot, "package.json");
  if (!existsSync(packageJsonPath)) {
    throw new BootstrapAssetError(`Missing package.json at ${packageJsonPath}.`);
  }

  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: unknown };
  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new BootstrapAssetError(`Missing version in ${packageJsonPath}.`);
  }

  return parsed.version;
}

export function readSourceBootstrapManifest(manifestPath: string): SourceBootstrapManifest {
  if (!existsSync(manifestPath)) {
    throw new BootstrapAssetError(`Missing bootstrap source manifest at ${manifestPath}.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    throw new BootstrapAssetError(
      `Bootstrap source manifest contains invalid JSON (${manifestPath}): ${message}`
    );
  }

  return parseSourceBootstrapManifest(parsed);
}

function isExcluded(relativePosixPath: string, patterns: string[]): boolean {
  return patterns.some((pattern) =>
    minimatch(relativePosixPath, pattern, { dot: true, nocase: false })
  );
}

function assertRegularFileInsideRoot(
  absolutePath: string,
  root: string,
  label: string
): { realPath: string; mode: number } {
  const stats = lstatSync(absolutePath);
  if (stats.isSymbolicLink()) {
    const followed = statSync(absolutePath);
    if (followed.isDirectory()) {
      throw new BootstrapAssetError(`${label} is a directory symlink, which is not allowed.`);
    }
  } else if (!stats.isFile()) {
    throw new BootstrapAssetError(`${label} is not a regular file.`);
  }

  const realPath = realpathSync(absolutePath);
  const realRoot = realpathSync(root);
  if (realPath !== realRoot && !realPath.startsWith(`${realRoot}${path.sep}`)) {
    throw new BootstrapAssetError(`${label} resolves outside ${realRoot}.`);
  }

  return { realPath, mode: statSync(realPath).mode };
}

function expandFileEntry(repoRoot: string, entry: SourceBootstrapManifestEntry): ExpandedFile[] {
  const absoluteSource = resolveContainedPath(repoRoot, entry.source, "source");
  if (!existsSync(absoluteSource)) {
    throw new BootstrapAssetError(`Bootstrap source file is missing: ${entry.source}.`);
  }

  const stats = lstatSync(absoluteSource);
  if (stats.isDirectory() || (stats.isSymbolicLink() && statSync(absoluteSource).isDirectory())) {
    throw new BootstrapAssetError(
      `Bootstrap source "${entry.source}" is a directory; omit exclude only for files, or add directory excludes.`
    );
  }

  assertRegularFileInsideRoot(absoluteSource, repoRoot, `source "${entry.source}"`);
  if (entry.exclude !== undefined && entry.exclude.length > 0) {
    throw new BootstrapAssetError(`File source "${entry.source}" cannot declare exclude patterns.`);
  }

  return [
    {
      source: entry.source,
      destination: entry.destination,
      absoluteSource,
    },
  ];
}

function expandDirectoryEntry(
  repoRoot: string,
  entry: SourceBootstrapManifestEntry
): ExpandedFile[] {
  const absoluteSource = resolveContainedPath(repoRoot, entry.source, "source");
  if (!existsSync(absoluteSource)) {
    throw new BootstrapAssetError(`Bootstrap source directory is missing: ${entry.source}.`);
  }

  const stats = lstatSync(absoluteSource);
  if (stats.isSymbolicLink()) {
    throw new BootstrapAssetError(
      `Bootstrap source "${entry.source}" is a directory symlink, which is not allowed.`
    );
  }
  if (!stats.isDirectory()) {
    throw new BootstrapAssetError(`Bootstrap source "${entry.source}" is not a directory.`);
  }

  const exclude = [...ARTIFACT_EXCLUDE_GLOBS, ...(entry.exclude ?? [])];
  const files: ExpandedFile[] = [];

  const walk = (absoluteDir: string, relativePosix: string): void => {
    const names = readdirSync(absoluteDir).sort(comparePosixPaths);
    for (const name of names) {
      if (SKIP_DIRECTORY_NAMES.has(name)) {
        continue;
      }

      const childRelative = relativePosix ? joinPosix(relativePosix, name) : name;
      if (isExcluded(childRelative, exclude)) {
        continue;
      }

      const childAbsolute = path.join(absoluteDir, name);
      const childStats = lstatSync(childAbsolute);

      if (childStats.isSymbolicLink()) {
        const followed = statSync(childAbsolute);
        if (followed.isDirectory()) {
          throw new BootstrapAssetError(
            `Directory symlink is not allowed in bootstrap source "${entry.source}/${childRelative}".`
          );
        }
        assertRegularFileInsideRoot(
          childAbsolute,
          repoRoot,
          `source "${joinPosix(entry.source, childRelative)}"`
        );
        files.push({
          source: joinPosix(entry.source, childRelative),
          destination: joinPosix(entry.destination, childRelative),
          absoluteSource: childAbsolute,
        });
        continue;
      }

      if (childStats.isDirectory()) {
        walk(childAbsolute, childRelative);
        continue;
      }

      if (!childStats.isFile()) {
        throw new BootstrapAssetError(
          `Unsupported bootstrap source type at "${joinPosix(entry.source, childRelative)}".`
        );
      }

      files.push({
        source: joinPosix(entry.source, childRelative),
        destination: joinPosix(entry.destination, childRelative),
        absoluteSource: childAbsolute,
      });
    }
  };

  walk(absoluteSource, "");
  if (files.length === 0) {
    throw new BootstrapAssetError(
      `Bootstrap source directory "${entry.source}" did not match any files.`
    );
  }

  return files;
}

export function expandSourceBootstrapManifest(
  repoRoot: string,
  manifest: SourceBootstrapManifest
): ExpandedFile[] {
  const expanded: ExpandedFile[] = [];

  for (const entry of manifest.entries) {
    const absoluteSource = resolveContainedPath(repoRoot, entry.source, "source");
    if (!existsSync(absoluteSource)) {
      throw new BootstrapAssetError(`Bootstrap source path is missing: ${entry.source}.`);
    }

    const stats = lstatSync(absoluteSource);
    const isDirectory = stats.isDirectory() && !stats.isSymbolicLink();
    const files = isDirectory
      ? expandDirectoryEntry(repoRoot, entry)
      : expandFileEntry(repoRoot, entry);
    expanded.push(...files);
  }

  const destinations = expanded.map((file) => file.destination);
  const seen = new Set<string>();
  for (const destination of destinations) {
    if (seen.has(destination)) {
      throw new BootstrapAssetError(
        `Duplicate destination path "${destination}" after expanding the bootstrap manifest.`
      );
    }
    seen.add(destination);
  }

  assertNoDestinationPrefixConflicts(destinations);

  const generatedDestinations = new Set(manifest.generatedAtInit.map((entry) => entry.destination));
  for (const destination of destinations) {
    if (generatedDestinations.has(destination)) {
      throw new BootstrapAssetError(
        `Destination "${destination}" is listed as generated-at-init and cannot also be packaged.`
      );
    }
  }

  return [...expanded].sort((left, right) =>
    comparePosixPaths(left.destination, right.destination)
  );
}

function copyExpandedFile(
  file: ExpandedFile,
  filesRoot: string,
  repoRoot: string
): PackagedBootstrapManifestEntry {
  const { realPath, mode } = assertRegularFileInsideRoot(
    file.absoluteSource,
    repoRoot,
    `source "${file.source}"`
  );
  const destinationPath = resolveContainedPath(filesRoot, file.destination, "destination");
  mkdirSync(path.dirname(destinationPath), { recursive: true });
  if (file.destination === CONSUMER_UI_PACKAGE_JSON_DESTINATION) {
    writeFileSync(
      destinationPath,
      toConsumerUiPackageManifest(readFileSync(realPath, "utf8")),
      "utf8"
    );
  } else {
    copyFileSync(realPath, destinationPath);
  }
  chmodSync(destinationPath, mode & 0o777);

  const bytes = readFileSync(destinationPath);
  return {
    source: file.source,
    destination: file.destination,
    sha256: sha256Bytes(bytes),
    mode: formatPosixMode(mode),
  };
}

export function buildBootstrapAssets(
  options: BuildBootstrapAssetsOptions
): PackagedBootstrapManifest {
  const repoRoot = path.resolve(options.repoRoot);
  const packageRoot = path.resolve(options.packageRoot);
  const sourceManifestPath =
    options.sourceManifestPath ?? path.join(packageRoot, SOURCE_BOOTSTRAP_MANIFEST_RELATIVE_PATH);
  const outputDir = options.outputDir ?? packagedBootstrapAssetRoot(packageRoot);

  const sourceManifest = readSourceBootstrapManifest(sourceManifestPath);
  const expanded = expandSourceBootstrapManifest(repoRoot, sourceManifest);

  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true, force: true });
  }

  const filesRoot = packagedBootstrapFilesRoot(outputDir);
  mkdirSync(filesRoot, { recursive: true });

  const entries = expanded.map((file) => copyExpandedFile(file, filesRoot, repoRoot));
  const packaged: PackagedBootstrapManifest = {
    schemaVersion: BOOTSTRAP_MANIFEST_SCHEMA_VERSION,
    atlasVersion: readPackageVersion(packageRoot),
    generatedAtInit: sourceManifest.generatedAtInit,
    entries,
  };

  writeFileSync(
    packagedBootstrapManifestPath(outputDir),
    serializePackagedBootstrapManifest(packaged),
    "utf8"
  );

  verifyPackagedBootstrapTree(outputDir);
  return packaged;
}

export function buildBootstrapAssetsFromCliPackage(): PackagedBootstrapManifest {
  const packageRoot = findCliPackageRoot(__dirname);
  const repoRoot = path.resolve(packageRoot, "..", "..");
  return buildBootstrapAssets({ repoRoot, packageRoot });
}
