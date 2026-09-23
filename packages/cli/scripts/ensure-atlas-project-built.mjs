import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultPackageRoot = path.resolve(scriptDir, "..");
const defaultMonorepoRoot = path.resolve(defaultPackageRoot, "../..");

export const ATLAS_PROJECT_PACKAGE_NAME = "@atlas/project";

/**
 * `@atlas/project` package.json `exports`/`types` point at `dist/`. CLI `tsc`
 * (`tsconfig.build.json`, Node module resolution) cannot resolve the workspace
 * package until that private package has been built.
 *
 * `pnpm --filter @blitzcraftlabs/atlas build` does not run Turbo `^build`, so
 * pack/doctor/snapshot paths must prepare this dependency themselves.
 */
export function atlasProjectDistIndex(projectDir) {
  return path.join(projectDir, "dist", "index.js");
}

export function atlasProjectTypesEntry(projectDir) {
  return path.join(projectDir, "dist", "index.d.ts");
}

/**
 * @param {{
 *   monorepoRoot?: string;
 *   projectDir?: string;
 *   env?: NodeJS.ProcessEnv;
 *   stdio?: "inherit" | "pipe";
 *   reason?: string;
 * }} [options]
 */
export function ensureAtlasProjectBuilt(options = {}) {
  const monorepoRoot = options.monorepoRoot ?? defaultMonorepoRoot;
  const projectDir = options.projectDir ?? path.join(monorepoRoot, "packages", "project");
  const reason =
    options.reason ??
    `TypeScript and bundled CLI code import ${ATLAS_PROJECT_PACKAGE_NAME}, whose package exports point at dist/`;

  const projectManifest = path.join(projectDir, "package.json");
  if (!existsSync(projectManifest)) {
    throw new Error(`Cannot build the CLI without ${ATLAS_PROJECT_PACKAGE_NAME} at ${projectDir}.`);
  }

  const distIndex = atlasProjectDistIndex(projectDir);
  if (!existsSync(distIndex)) {
    // Incremental tsc can succeed without emitting when dist/ was removed but
    // tsbuildinfo remains. Drop the stale cache so a clean checkout actually builds.
    rmSync(path.join(projectDir, "tsconfig.build.tsbuildinfo"), { force: true });
  }

  const result = spawnSync("pnpm", ["--filter", ATLAS_PROJECT_PACKAGE_NAME, "build"], {
    cwd: monorepoRoot,
    encoding: "utf8",
    env: options.env ?? process.env,
    stdio: options.stdio ?? "inherit",
  });

  if (result.error) {
    throw new Error(
      `Failed to start ${ATLAS_PROJECT_PACKAGE_NAME} build (${reason}): ${result.error.message}`
    );
  }

  if (result.status !== 0) {
    const detail =
      options.stdio === "pipe" ? `\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}` : "";
    throw new Error(
      `Failed to build ${ATLAS_PROJECT_PACKAGE_NAME} (exit ${result.status ?? "null"}). ${reason}.${detail}`
    );
  }

  if (!existsSync(distIndex) || !existsSync(atlasProjectTypesEntry(projectDir))) {
    throw new Error(
      `${ATLAS_PROJECT_PACKAGE_NAME} build completed without writing dist/index.js and dist/index.d.ts.`
    );
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  ensureAtlasProjectBuilt();
}
