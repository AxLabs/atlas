#!/usr/bin/env node
/**
 * Build, pack, and validate the exact `@blitzcraftlabs/atlas` tarball that a
 * maintainer may publish. This command never publishes.
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { PUBLIC_CLI_PACKAGE_NAME } from "./atlas-workspaces.mjs";
import { resolveAtlasRepoRoot } from "./lib/distribution-clean-room.mjs";
import {
  NPM_ARTIFACT_RELATIVE_DIR,
  buildManualPublishCommand,
  packExactPublicCliTarball,
  queryNpmPackageVersion,
  writePublishManifest,
} from "./lib/npm-publication.mjs";

const scriptPath = fileURLToPath(import.meta.url);

function writeHelp() {
  process.stdout
    .write(`Usage: pnpm distribution:prepare-publish [--skip-build] [--require-release-tag]

Build @blitzcraftlabs/atlas once, pack the exact tarball, validate that file,
and print the one-time first-publish command. This does not authenticate to npm
or publish a version.

First npm publication of 1.0.0 must run from an isolated checkout of the
canonical Git tag:

  git fetch --tags
  git worktree add /tmp/atlas-v1.0.0 v1.0.0
  cd /tmp/atlas-v1.0.0
  pnpm install --frozen-lockfile
  pnpm distribution:prepare-publish --require-release-tag

--skip-build            Pack the already-built CLI dist without rebuilding.
--require-release-tag   Fail unless HEAD is the exact vX.Y.Z tag matching the
                        package version and the working tree is clean.
`);
}

function parseArgs(argv) {
  const options = { help: false, skipBuild: false, requireReleaseTag: false };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--skip-build") {
      options.skipBuild = true;
    } else if (arg === "--require-release-tag") {
      options.requireReleaseTag = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    writeHelp();
    return 0;
  }

  const repoRoot = resolveAtlasRepoRoot(path.dirname(scriptPath));
  const packed = packExactPublicCliTarball({
    repoRoot,
    skipBuild: options.skipBuild,
    requireReleaseTag: options.requireReleaseTag,
  });
  const registry = await queryNpmPackageVersion({ version: packed.identity.version });
  if (registry.versionExists) {
    throw new Error(
      `${PUBLIC_CLI_PACKAGE_NAME}@${packed.identity.version} already exists on npm. Refusing to prepare a duplicate publication.`
    );
  }

  const command = buildManualPublishCommand(packed.tarballPath);
  const manifestPath = packed.tarballPath.replace(/\.tgz$/, ".publish.json");
  writePublishManifest(manifestPath, {
    packageName: packed.identity.packageName,
    version: packed.identity.version,
    tag: packed.identity.tag,
    commitSha: packed.checkout?.headSha ?? null,
    tarball: packed.tarballName,
    tarballPath: packed.tarballPath,
    sha256: packed.sha256,
    bytes: packed.bytes,
    registry: registry.status,
    manualPublishCommand: command,
    requireReleaseTag: options.requireReleaseTag,
    note: "Publish this exact tarball from the canonical Git tag. Do not rebuild and do not publish a different file.",
  });

  process.stdout.write(
    [
      `Prepared ${PUBLIC_CLI_PACKAGE_NAME}@${packed.identity.version}`,
      `  Tarball: ${packed.tarballPath}`,
      `  SHA-256: ${packed.sha256}`,
      `  Bytes: ${packed.bytes}`,
      `  Tag: ${packed.identity.tag}`,
      packed.checkout?.headSha ? `  Commit: ${packed.checkout.headSha}` : null,
      `  Registry: ${registry.status}`,
      `  Manifest: ${manifestPath}`,
      "",
      "First publication (human-authenticated, one-time):",
      `  ${command}`,
      "",
      "Then: pnpm distribution:verify-registry " + packed.identity.version,
      "",
      "Do not rebuild. Do not run npm publish against packages/cli.",
      `Output also written under ${path.join(repoRoot, NPM_ARTIFACT_RELATIVE_DIR)}`,
      "",
    ]
      .filter((line) => line !== null)
      .join("\n")
  );
  return 0;
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(scriptPath).href
) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
