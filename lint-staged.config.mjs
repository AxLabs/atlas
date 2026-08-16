import path from "node:path";

import {
  buildEslintCommands,
  buildPrettierCommand,
} from "./scripts/lint-staged-utils.mjs";

const ESLINT_BIN = path.join(process.cwd(), "node_modules/.bin/eslint");

/** @type {import('lint-staged').Configuration} */
export default {
  "*.{js,jsx,ts,tsx}": (filenames) => [
    ...buildEslintCommands(filenames, { eslintBin: ESLINT_BIN }),
    buildPrettierCommand(filenames),
  ],
  "*.{json,md,yml,yaml}": (filenames) => buildPrettierCommand(filenames),
};
