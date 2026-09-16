#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { PUBLIC_CLI_PACKAGE_NAME, PUBLIC_CLI_RELATIVE_PATH } from "./atlas-workspaces.mjs";
import { resolveAtlasRepoRoot } from "./lib/distribution-clean-room.mjs";
import { verifyNpmPublishDryRun } from "./lib/npm-publish-dry-run.mjs";

const scriptPath = fileURLToPath(import.meta.url);

function writeHelp() {
  process.stdout.write(`Usage: pnpm distribution:publish-dry-run

Prove that npm would accept @blitzcraftlabs/atlas structurally without publishing it.

Runs \`npm pack --dry-run\` and \`npm publish --dry-run --access public\` against
packages/cli. This check does not authenticate to npm, create a package, or
publish a version. npm may warn that a real publish would require login; that
warning is expected without credentials.
`);
}

function parseArgs(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    return { help: true };
  }
  if (argv.length > 0) {
    throw new Error(`Unknown argument: ${argv[0]}`);
  }
  return { help: false };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    writeHelp();
    return 0;
  }

  const repoRoot = resolveAtlasRepoRoot(path.dirname(scriptPath));
  const packageRoot = path.join(repoRoot, PUBLIC_CLI_RELATIVE_PATH);
  const result = verifyNpmPublishDryRun({ packageRoot });
  const fileCount = result.packedFiles.length;
  process.stdout.write(
    `npm publish dry-run ok ${PUBLIC_CLI_PACKAGE_NAME}@${String(result.manifest.version)} (${fileCount} files${
      result.filename ? `; ${result.filename}` : ""
    })\n`
  );
  return 0;
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(scriptPath).href
) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
