import { spawnSync } from "node:child_process";
import path from "node:path";

/** Workspaces with their own eslint.config.mjs (root config ignores apps/** and packages/**). */
export const ESLINT_PACKAGES = [
  "apps/web",
  "packages/ui",
  "packages/consent",
  "packages/config",
];

/**
 * Escape a path for use inside double-quoted arguments parsed without a shell.
 * @param {string} file
 */
export function quote(file) {
  return `"${file.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Convert lint-staged absolute (or mixed) filenames to repo-relative POSIX paths.
 * @param {string} file
 * @param {string} cwd
 */
export function toRepoRelativePosix(file, cwd = process.cwd()) {
  const candidate = file.replace(/\\/g, "/");
  const resolved = path.isAbsolute(candidate)
    ? path.normalize(candidate)
    : path.resolve(cwd, candidate);
  return path.relative(cwd, resolved).split(path.sep).join("/");
}

/**
 * Group staged files by ESLint workspace root.
 * @param {string[]} filenames
 * @param {string[]} [eslintPackages]
 * @param {string} [cwd]
 */
export function groupByEslintRoot(filenames, eslintPackages = ESLINT_PACKAGES, cwd = process.cwd()) {
  /** @type {Map<string, string[]>} */
  const groups = new Map();
  const rootFiles = [];

  for (const file of filenames) {
    const normalized = toRepoRelativePosix(file, cwd);
    const packageDir = eslintPackages.find(
      (dir) => normalized === dir || normalized.startsWith(`${dir}/`),
    );

    if (packageDir) {
      const files = groups.get(packageDir) ?? [];
      files.push(normalized);
      groups.set(packageDir, files);
    } else {
      rootFiles.push(normalized);
    }
  }

  return { groups, rootFiles };
}

/**
 * @typedef {{ cwd: string, args: string[] }} EslintInvocation
 */

/**
 * Build ESLint argv groups. Each workspace runs with `cwd` set to that package so
 * its eslint.config.mjs applies. Avoids `cd … && …` (lint-staged does not spawn a shell)
 * and ESLint 9's removed `--cwd` flag.
 * @param {string[]} filenames
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @param {string[]} [options.eslintPackages]
 * @returns {EslintInvocation[]}
 */
export function buildEslintInvocations(
  filenames,
  { cwd = process.cwd(), eslintPackages = ESLINT_PACKAGES } = {},
) {
  const { groups, rootFiles } = groupByEslintRoot(filenames, eslintPackages, cwd);
  /** @type {EslintInvocation[]} */
  const invocations = [];

  for (const [packageDir, files] of groups) {
    const relativeFiles = files.map((file) => path.posix.relative(packageDir, file));
    invocations.push({
      cwd: packageDir,
      args: ["--fix", "--", ...relativeFiles],
    });
  }

  if (rootFiles.length > 0) {
    invocations.push({
      cwd: ".",
      args: ["--fix", "--", ...rootFiles],
    });
  }

  return invocations;
}

/**
 * Execute ESLint for staged files using workspace-local configuration.
 * @param {string[]} filenames
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @param {string} [options.eslintBin]
 * @param {string[]} [options.eslintPackages]
 * @param {"inherit" | "pipe"} [options.stdio]
 */
export function runEslintForStagedFiles(
  filenames,
  {
    cwd = process.cwd(),
    eslintBin = path.join(cwd, "node_modules/.bin/eslint"),
    eslintPackages = ESLINT_PACKAGES,
    stdio = "inherit",
  } = {},
) {
  const invocations = buildEslintInvocations(filenames, { cwd, eslintPackages });
  for (const invocation of invocations) {
    const result = spawnSync(eslintBin, invocation.args, {
      cwd: path.resolve(cwd, invocation.cwd),
      encoding: "utf8",
      stdio,
    });
    if (result.error) {
      throw result.error;
    }
    if ((result.status ?? 1) !== 0) {
      const detail = stdio === "pipe" ? `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() : "";
      const suffix = detail ? `:\n${detail}` : "";
      throw new Error(`ESLint failed in ${invocation.cwd}${suffix}`);
    }
  }
}

/**
 * Build Prettier --write command for staged files.
 * @param {string[]} filenames
 * @param {object} [options]
 * @param {string} [options.cwd]
 */
export function buildPrettierCommand(filenames, { cwd = process.cwd() } = {}) {
  const relativeFiles = filenames.map((file) => toRepoRelativePosix(file, cwd));
  return `prettier --write ${relativeFiles.map(quote).join(" ")}`;
}
