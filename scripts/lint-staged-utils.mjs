import path from "node:path";

/** Workspaces with their own eslint.config.mjs (root config ignores apps/** and packages/**). */
export const ESLINT_PACKAGES = [
  "apps/web",
  "packages/ui",
  "packages/consent",
  "packages/config",
];

/**
 * Escape a path for use inside double-quoted shell arguments.
 * @param {string} file
 */
export function quote(file) {
  return `"${file.replace(/"/g, '\\"')}"`;
}

/**
 * Group staged files by ESLint workspace root.
 * @param {string[]} filenames
 * @param {string[]} eslintPackages
 */
export function groupByEslintRoot(filenames, eslintPackages = ESLINT_PACKAGES) {
  /** @type {Map<string, string[]>} */
  const groups = new Map();
  const rootFiles = [];

  for (const file of filenames) {
    const normalized = file.replace(/\\/g, "/");
    const packageDir = eslintPackages.find((dir) => normalized.startsWith(`${dir}/`));

    if (packageDir) {
      const files = groups.get(packageDir) ?? [];
      files.push(file);
      groups.set(packageDir, files);
    } else {
      rootFiles.push(file);
    }
  }

  return { groups, rootFiles };
}

/**
 * Build ESLint --fix commands for staged files, routing each workspace to its own config.
 * @param {string[]} filenames
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @param {string} [options.eslintBin]
 * @param {string[]} [options.eslintPackages]
 */
export function buildEslintCommands(
  filenames,
  { cwd = process.cwd(), eslintBin = path.join(cwd, "node_modules/.bin/eslint"), eslintPackages = ESLINT_PACKAGES } = {},
) {
  const { groups, rootFiles } = groupByEslintRoot(filenames, eslintPackages);
  const commands = [];

  for (const [packageDir, files] of groups) {
    const relativeFiles = files.map((file) => path.relative(packageDir, file));
    commands.push(
      `cd ${quote(packageDir)} && ${quote(eslintBin)} --fix ${relativeFiles.map(quote).join(" ")}`,
    );
  }

  if (rootFiles.length > 0) {
    commands.push(`${quote(eslintBin)} --fix ${rootFiles.map(quote).join(" ")}`);
  }

  return commands;
}

/**
 * Build Prettier --write command for staged files.
 * @param {string[]} filenames
 */
export function buildPrettierCommand(filenames) {
  return `prettier --write ${filenames.map(quote).join(" ")}`;
}
