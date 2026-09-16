import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import * as esbuild from "esbuild";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const cacheDir = path.join(scriptDir, ".cache");
const outfile = path.join(cacheDir, "build-release-assets.cjs");

export async function runReleaseAssetBuild() {
  mkdirSync(cacheDir, { recursive: true });
  await esbuild.build({
    absWorkingDir: packageRoot,
    bundle: true,
    entryPoints: [path.join(packageRoot, "src/upgrade/build-release-assets-main.ts")],
    outfile,
    format: "cjs",
    legalComments: "none",
    logLevel: "warning",
    platform: "node",
    sourcemap: false,
    target: "node22",
  });

  const result = spawnSync(process.execPath, [outfile], {
    cwd: packageRoot,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    rmSync(cacheDir, { recursive: true, force: true });
    throw new Error(`Release asset build failed with status ${result.status ?? "null"}`);
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  await runReleaseAssetBuild();
}
