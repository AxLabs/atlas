import { chmodSync, copyFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as esbuild from "esbuild";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(packageRoot, "../..");
const distDir = path.join(packageRoot, "dist");
const packageJsonPath = path.join(packageRoot, "package.json");

const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const runtimeExternals = Object.keys(pkg.dependencies ?? {});

const shared = {
  absWorkingDir: packageRoot,
  bundle: true,
  external: runtimeExternals,
  format: "cjs",
  legalComments: "none",
  logLevel: "warning",
  platform: "node",
  sourcemap: false,
  target: "node22",
};

mkdirSync(distDir, { recursive: true });

await Promise.all([
  esbuild.build({
    ...shared,
    entryPoints: [path.join(packageRoot, "src/cli.ts")],
    outfile: path.join(distDir, "cli.js"),
  }),
  esbuild.build({
    ...shared,
    entryPoints: [path.join(packageRoot, "src/index.ts")],
    outfile: path.join(distDir, "index.js"),
  }),
  esbuild.build({
    ...shared,
    entryPoints: [path.join(packageRoot, "src/dependency-validation.ts")],
    outfile: path.join(distDir, "dependency-validation.js"),
  }),
  esbuild.build({
    ...shared,
    entryPoints: [path.join(packageRoot, "src/bootstrap-assets.ts")],
    outfile: path.join(distDir, "bootstrap-assets.js"),
  }),
  esbuild.build({
    ...shared,
    entryPoints: [path.join(packageRoot, "src/release-assets.ts")],
    outfile: path.join(distDir, "release-assets.js"),
  }),
]);

chmodSync(path.join(distDir, "cli.js"), 0o755);
copyFileSync(path.join(repoRoot, "LICENSE"), path.join(packageRoot, "LICENSE"));
copyFileSync(
  path.join(repoRoot, "THIRD_PARTY_NOTICES.md"),
  path.join(packageRoot, "THIRD_PARTY_NOTICES.md")
);

const { runBootstrapAssetBuild } = await import("./build-bootstrap-assets.mjs");
await runBootstrapAssetBuild();
const { runReleaseAssetBuild } = await import("./build-release-assets.mjs");
await runReleaseAssetBuild();
