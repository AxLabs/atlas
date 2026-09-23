import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import * as esbuild from "esbuild";

import { ensureAtlasProjectBuilt } from "./ensure-atlas-project-built.mjs";

export { ensureAtlasProjectBuilt };

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const cacheDir = path.join(scriptDir, ".cache");
const outfile = path.join(cacheDir, "generate-production-release-snapshot.cjs");

function parseArgs(argv) {
  const options = {
    repoRoot: process.cwd(),
    outputDir: undefined,
    replace: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--repo-root") {
      options.repoRoot = argv[index + 1];
      index += 1;
    } else if (arg === "--output-dir") {
      options.outputDir = argv[index + 1];
      index += 1;
    } else if (arg === "--replace") {
      options.replace = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.repoRoot) {
    throw new Error("Missing value for --repo-root");
  }

  return options;
}

function readCliVersion(repoRoot) {
  const packageJsonPath = path.join(repoRoot, "packages", "cli", "package.json");
  if (!existsSync(packageJsonPath)) {
    return null;
  }
  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  return typeof parsed.version === "string" ? parsed.version : null;
}

export function shouldGenerateProductionSnapshot(repoRoot) {
  return (
    existsSync(path.join(repoRoot, "templates", "app-infrastructure.manifest.json")) &&
    existsSync(path.join(repoRoot, "packages", "cli", "package.json")) &&
    existsSync(path.join(repoRoot, "atlas.config.json"))
  );
}

export async function generateProductionReleaseSnapshotFromTree(options) {
  const repoRoot = path.resolve(options.repoRoot);
  if (!shouldGenerateProductionSnapshot(repoRoot)) {
    return { status: "skipped", reason: "not-an-atlas-checkout" };
  }

  const version = readCliVersion(repoRoot);
  if (!version) {
    throw new Error("Unable to read Atlas CLI package version");
  }

  const outputDir = path.resolve(
    options.outputDir ??
      path.join(repoRoot, "packages", "cli", "release-assets", "production", version)
  );
  const snapshotPath = path.join(outputDir, "release.snapshot.json");
  if (existsSync(snapshotPath) && options.replace !== true) {
    return { status: "skipped", reason: "snapshot-exists", version, outputDir };
  }

  ensureAtlasProjectBuilt();

  mkdirSync(cacheDir, { recursive: true });
  await esbuild.build({
    absWorkingDir: packageRoot,
    bundle: true,
    entryPoints: [path.join(packageRoot, "src/upgrade/production-snapshot.ts")],
    outfile,
    format: "cjs",
    legalComments: "none",
    logLevel: "warning",
    platform: "node",
    sourcemap: false,
    target: "node22",
  });

  const result = spawnSync(
    process.execPath,
    [
      "-e",
      `
const { generateProductionReleaseSnapshot } = require(${JSON.stringify(outfile)});
generateProductionReleaseSnapshot({
  repoRoot: ${JSON.stringify(repoRoot)},
  outputDir: ${JSON.stringify(outputDir)},
  replace: ${options.replace === true}
});
`,
    ],
    {
      cwd: packageRoot,
      stdio: "inherit",
    }
  );

  if (result.status !== 0) {
    throw new Error(`Production snapshot generation failed with status ${result.status ?? "null"}`);
  }

  return { status: "generated", version, outputDir };
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  const options = parseArgs(process.argv.slice(2));
  const result = await generateProductionReleaseSnapshotFromTree(options);
  if (result.status === "skipped") {
    process.stdout.write(
      `Skipped production snapshot generation (${result.reason}${result.version ? ` ${result.version}` : ""}).\n`
    );
  } else {
    process.stdout.write(
      `Generated production snapshot for Atlas ${result.version} at ${result.outputDir}\n`
    );
  }
}
