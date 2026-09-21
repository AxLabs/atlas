import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { findCliPackageRoot } from "../version";
import { listCapabilityDefinitions } from "../enable/registry";
import { computeCapabilityPackagePatches } from "../enable/patches";
import { formatPosixMode, sha256Bytes } from "./checksum";
import { expandSourceBootstrapManifest } from "./build";
import { BOOTSTRAP_MANIFEST_SCHEMA_VERSION } from "./constants";
import { BootstrapAssetError } from "./errors";
import { resolveContainedPath } from "./paths";
import {
  CAPABILITIES_MANIFEST_SCHEMA_VERSION,
  packagedCapabilitiesAssetRoot,
  packagedCapabilitiesFilesRoot,
  packagedCapabilitiesManifestPath,
} from "./capability-assets";

import type {
  PackagedCapabilitiesManifest,
  PackagedCapability,
  PackagedCapabilityEntry,
} from "../enable/types";

export interface BuildCapabilityAssetsOptions {
  repoRoot: string;
  packageRoot: string;
  outputDir?: string;
}

function readPackageVersion(packageRoot: string): string {
  const parsed = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8")) as {
    version?: unknown;
  };
  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new BootstrapAssetError("CLI package.json is missing version.");
  }
  return parsed.version;
}

function readJsonObject(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

function readAtlasPnpmOverrides(repoRoot: string): Record<string, string> {
  const root = readJsonObject(path.join(repoRoot, "package.json"));
  const pnpm = root.pnpm as { overrides?: Record<string, string> } | undefined;
  return pnpm?.overrides ?? {};
}

export function buildCapabilityAssets(
  options: BuildCapabilityAssetsOptions
): PackagedCapabilitiesManifest {
  const repoRoot = path.resolve(options.repoRoot);
  const packageRoot = path.resolve(options.packageRoot);
  const outputDir = options.outputDir ?? packagedCapabilitiesAssetRoot(packageRoot);
  const atlasVersion = readPackageVersion(packageRoot);
  const canonicalUi = readJsonObject(path.join(repoRoot, "packages/ui/package.json")) as {
    scripts?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const atlasOverrides = readAtlasPnpmOverrides(repoRoot);

  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true, force: true });
  }

  const filesRoot = packagedCapabilitiesFilesRoot(outputDir);
  mkdirSync(filesRoot, { recursive: true });

  const capabilities: PackagedCapability[] = [];

  for (const definition of listCapabilityDefinitions()) {
    const entries: PackagedCapabilityEntry[] = [];

    if (definition.files.length > 0) {
      const expanded = expandSourceBootstrapManifest(repoRoot, {
        schemaVersion: BOOTSTRAP_MANIFEST_SCHEMA_VERSION,
        generatedAtInit: [],
        entries: definition.files,
      });

      const capabilityFilesRoot = path.join(filesRoot, definition.id);
      mkdirSync(capabilityFilesRoot, { recursive: true });

      for (const file of expanded) {
        const destinationPath = resolveContainedPath(
          capabilityFilesRoot,
          file.destination,
          "capability destination"
        );
        mkdirSync(path.dirname(destinationPath), { recursive: true });
        copyFileSync(file.absoluteSource, destinationPath);
        const sourceMode = statSync(file.absoluteSource).mode;
        chmodSync(destinationPath, sourceMode & 0o777);
        const bytes = readFileSync(destinationPath);
        entries.push({
          destination: file.destination,
          sha256: sha256Bytes(bytes),
          mode: formatPosixMode(sourceMode),
        });
      }
    }

    capabilities.push({
      id: definition.id,
      title: definition.title,
      description: definition.description,
      tier: definition.tier,
      heavier: definition.heavier,
      requires: [...definition.requires],
      detectPath: definition.detectPath,
      generated: definition.generated,
      validationCommand: definition.validationCommand,
      entries,
      packagePatches: computeCapabilityPackagePatches({
        capability: definition,
        canonicalUi,
        atlasOverrides,
      }),
    });
  }

  const packaged: PackagedCapabilitiesManifest = {
    schemaVersion: CAPABILITIES_MANIFEST_SCHEMA_VERSION,
    atlasVersion,
    capabilities,
  };

  writeFileSync(
    packagedCapabilitiesManifestPath(outputDir),
    `${JSON.stringify(packaged, null, 2)}\n`
  );
  return packaged;
}

export function buildCapabilityAssetsFromCliPackage(): PackagedCapabilitiesManifest {
  const packageRoot = findCliPackageRoot(__dirname);
  const repoRoot = path.resolve(packageRoot, "..", "..");
  return buildCapabilityAssets({ repoRoot, packageRoot });
}
