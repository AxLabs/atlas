import {
  buildEslintCommand,
  buildPrettierCommand,
} from "./scripts/lint-staged-utils.mjs";

/** @type {import('lint-staged').Configuration} */
export default {
  "*.{js,jsx,ts,tsx}": (filenames) => [
    buildEslintCommand(filenames),
    buildPrettierCommand(filenames),
  ],
  "*.{json,md,yml,yaml}": (filenames) => buildPrettierCommand(filenames),
};
