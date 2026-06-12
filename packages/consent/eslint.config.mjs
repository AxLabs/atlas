import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import tseslint from "typescript-eslint";

import baseConfig from "@atlas/config/eslint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default [
  ...baseConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        tsconfigRootDir: __dirname,
        project: "./tsconfig.json",
      },
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**/*.ts", "**/__tests__/**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/require-await": "off",
      "no-console": "off",
    },
  },
  {
    files: ["jest.config.js", "jest.setup.js"],
    languageOptions: {
      globals: {
        process: "readonly",
        module: "readonly",
        require: "readonly",
      },
    },
    plugins: {},
    rules: {
      "no-undef": "off",
      "no-console": "off",
    },
  },
];
