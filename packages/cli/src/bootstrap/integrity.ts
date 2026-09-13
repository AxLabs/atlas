import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

import { sha256Bytes } from "./checksum";
import { PACKAGED_BOOTSTRAP_FILES_DIR } from "./constants";
import { BootstrapAssetError } from "./errors";
import { assertNoDestinationPrefixConflicts, comparePosixPaths } from "./paths";
import {
  packagedBootstrapFilesRoot,
  packagedBootstrapManifestPath,
  readBootstrapManifest,
} from "./resolve";

function listRelativeFiles(root: string): string[] {
  const files: string[] = [];

  const walk = (current: string, relative: string): void => {
    const names = readdirSync(current).sort(comparePosixPaths);
    for (const name of names) {
      const absolutePath = path.join(current, name);
      const childRelative = relative ? `${relative}/${name}` : name;
      const stats = statSync(absolutePath);
      if (stats.isDirectory()) {
        walk(absolutePath, childRelative);
        continue;
      }
      if (!stats.isFile()) {
        throw new BootstrapAssetError(
          `Unexpected non-file path in packaged bootstrap tree: ${childRelative}.`
        );
      }
      files.push(childRelative);
    }
  };

  if (existsSync(root)) {
    walk(root, "");
  }

  return files;
}

export function verifyPackagedBootstrapTree(assetRoot: string): void {
  const manifestPath = packagedBootstrapManifestPath(assetRoot);
  if (!existsSync(manifestPath)) {
    throw new BootstrapAssetError(`Missing packaged bootstrap manifest at ${manifestPath}.`);
  }

  const manifest = readBootstrapManifest(assetRoot);
  const filesRoot = packagedBootstrapFilesRoot(assetRoot);
  if (!existsSync(filesRoot)) {
    throw new BootstrapAssetError(`Missing packaged bootstrap files directory at ${filesRoot}.`);
  }

  const packagedFiles = new Set(listRelativeFiles(filesRoot));
  const destinations = manifest.entries.map((entry) => entry.destination);
  assertNoDestinationPrefixConflicts(destinations);

  for (const entry of manifest.entries) {
    if (!packagedFiles.has(entry.destination)) {
      throw new BootstrapAssetError(
        `Manifest destination "${entry.destination}" is missing from ${PACKAGED_BOOTSTRAP_FILES_DIR}/.`
      );
    }

    const absolutePath = path.join(filesRoot, ...entry.destination.split("/"));
    const realFile = realpathSync(absolutePath);
    const realRoot = realpathSync(filesRoot);
    if (realFile !== realRoot && !realFile.startsWith(`${realRoot}${path.sep}`)) {
      throw new BootstrapAssetError(
        `Packaged file "${entry.destination}" resolves outside the bootstrap files root.`
      );
    }

    const bytes = readFileSync(absolutePath);
    const digest = sha256Bytes(bytes);
    if (digest !== entry.sha256) {
      throw new BootstrapAssetError(
        `Checksum mismatch for packaged bootstrap asset "${entry.destination}".`
      );
    }

    packagedFiles.delete(entry.destination);
  }

  if (packagedFiles.size > 0) {
    const unexpected = [...packagedFiles].sort(comparePosixPaths);
    throw new BootstrapAssetError(
      `Packaged bootstrap tree contains files not listed in the manifest: ${unexpected.join(", ")}.`
    );
  }
}
