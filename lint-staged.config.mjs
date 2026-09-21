import path from "node:path";

import {
  buildPrettierCommand,
  runEslintForStagedFiles,
} from "./scripts/lint-staged-utils.mjs";

const ESLINT_BIN = path.join(process.cwd(), "node_modules/.bin/eslint");

/** @type {import('lint-staged').Configuration} */
export default {
  "*.{js,jsx,ts,tsx}": (filenames) => {
    runEslintForStagedFiles(filenames, { eslintBin: ESLINT_BIN });
    return [buildPrettierCommand(filenames)];
  },
  "*.{json,md,yml,yaml}": (filenames) => buildPrettierCommand(filenames),
};
