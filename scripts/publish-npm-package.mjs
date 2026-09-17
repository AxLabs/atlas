#!/usr/bin/env node
/**
 * GitHub Actions OIDC publisher for `@blitzcraftlabs/atlas`.
 *
 * Default is dry-run. Live publication requires --oidc on GitHub Actions after
 * the package already exists. The first version must be published from the
 * validated tarball by a human.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { PUBLIC_CLI_PACKAGE_NAME } from "./atlas-workspaces.mjs";
import { resolveAtlasRepoRoot } from "./lib/distribution-clean-room.mjs";
import {
  NPM_PUBLICATION_ACTIONS,
  NPM_TRUSTED_PUBLISHING_MIN_NPM,
  appendGithubOutput,
  collectTrustedPublishingToolchainIssues,
  decideNpmPublicationAction,
  hashFileSha256,
  packExactPublicCliTarball,
  publishExactTarball,
  queryNpmPackageVersion,
  writePublishManifest,
} from "./lib/npm-publication.mjs";

const scriptPath = fileURLToPath(import.meta.url);

function writeHelp() {
  process.stdout.write(`Usage: pnpm distribution:publish-npm [--dry-run | --oidc] [--skip-build]

Pack and validate the exact @blitzcraftlabs/atlas tarball, then either:

  --dry-run   Decide/publication-check without publishing (default)
  --oidc      Publish that exact tarball with npm Trusted Publishing

The first publication cannot use OIDC because the package does not exist yet.
That path is \`pnpm distribution:prepare-publish\` plus a human \`npm publish\` of
the printed tarball. This command never authenticates with NPM_TOKEN.
`);
}

function parseArgs(argv) {
  const options = { help: false, dryRun: false, oidc: false, skipBuild: false };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--oidc") {
      options.oidc = true;
    } else if (arg === "--skip-build") {
      options.skipBuild = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (options.oidc && options.dryRun) {
    throw new Error("Use either --oidc or --dry-run, not both");
  }
  if (!options.oidc) {
    options.dryRun = true;
  }
  return options;
}

function readNpmVersion() {
  const result = spawnSync("npm", ["--version"], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error("Unable to read npm --version for Trusted Publishing");
  }
  return result.stdout.trim();
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
  });
  const frozenHash = hashFileSha256(packed.tarballPath);
  if (frozenHash !== packed.sha256) {
    throw new Error("Packed tarball changed after validation");
  }

  const registry = await queryNpmPackageVersion({ version: packed.identity.version });
  const decision = decideNpmPublicationAction({
    packageExists: registry.packageExists,
    versionExists: registry.versionExists,
  });

  const manifestPath = packed.tarballPath.replace(/\.tgz$/, ".publish.json");
  writePublishManifest(manifestPath, {
    packageName: packed.identity.packageName,
    version: packed.identity.version,
    tag: packed.identity.tag,
    tarball: packed.tarballName,
    tarballPath: packed.tarballPath,
    sha256: packed.sha256,
    bytes: packed.bytes,
    action: decision.action,
    reason: decision.reason,
    registry: registry.status,
    mode: options.dryRun ? "dry-run" : "oidc",
  });

  appendGithubOutput("action", decision.action);
  appendGithubOutput("version", packed.identity.version);
  appendGithubOutput("tarball", packed.tarballPath);
  appendGithubOutput("sha256", packed.sha256);

  process.stdout.write(
    [
      `npm publication decision: ${decision.action}`,
      `  Package: ${PUBLIC_CLI_PACKAGE_NAME}@${packed.identity.version}`,
      `  Tag: ${packed.identity.tag}`,
      `  Tarball: ${packed.tarballPath}`,
      `  SHA-256: ${packed.sha256}`,
      `  Registry: ${registry.status}`,
      `  Reason: ${decision.reason}`,
      "",
    ].join("\n")
  );

  if (decision.action === NPM_PUBLICATION_ACTIONS.noop) {
    process.stdout.write("✓ Exact npm version already published; no registry mutation\n");
    return 0;
  }

  if (decision.action === NPM_PUBLICATION_ACTIONS.bootstrapRequired) {
    process.stdout.write(
      [
        "✓ First publication bootstrap is required.",
        "  Run `pnpm distribution:prepare-publish` and publish the printed tarball",
        "  with a human-authenticated `npm publish` of that exact file.",
        "  Do not rebuild. Do not publish from packages/cli.",
        "",
      ].join("\n")
    );
    return 0;
  }

  if (options.dryRun) {
    process.stdout.write("✓ Publication prerequisites satisfied (dry-run; no npm mutation)\n");
    return 0;
  }

  if (process.env.GITHUB_ACTIONS !== "true") {
    throw new Error("Refusing OIDC npm publish outside GitHub Actions");
  }

  const toolchainIssues = collectTrustedPublishingToolchainIssues({
    nodeVersion: process.versions.node,
    npmVersion: readNpmVersion(),
  });
  if (toolchainIssues.length > 0) {
    throw new Error(
      `Trusted Publishing toolchain is insufficient (need npm >= ${NPM_TRUSTED_PUBLISHING_MIN_NPM}):\n${toolchainIssues.join("\n")}`
    );
  }

  if (hashFileSha256(packed.tarballPath) !== packed.sha256) {
    throw new Error("Tarball was substituted after the registry existence check");
  }

  publishExactTarball({
    tarballPath: packed.tarballPath,
    expectedSha256: packed.sha256,
    cwd: repoRoot,
    provenance: true,
  });
  process.stdout.write(`✓ Published ${PUBLIC_CLI_PACKAGE_NAME}@${packed.identity.version}\n`);
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
