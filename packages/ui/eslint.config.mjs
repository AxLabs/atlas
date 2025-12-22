import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import baseConfig from "@atlas/config/eslint";
import tseslint from "typescript-eslint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default [
  ...baseConfig,
  {
    // Override parser options to specify this package's tsconfig
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["**/*.test.ts", "**/*.test.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        tsconfigRootDir: __dirname,
        project: "./tsconfig.json",
      },
    },
  },
  {
    // Test files use separate tsconfig
    files: ["**/*.test.ts", "**/*.test.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        tsconfigRootDir: __dirname,
        project: "./tsconfig.test.json",
      },
    },
  },
  {
    files: ["**/*.stories.tsx", "**/*.stories.ts", "**/*.stories.jsx", "**/*.stories.js"],
    rules: {
      // Storybook stories can use console for examples
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
    plugins: {}, // Explicitly clear plugins to avoid TS rules
    rules: {
      "no-undef": "off",
      "no-console": "off",
    },
  },
  {
    files: [".storybook/**/*.ts", ".storybook/**/*.js"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        process: "readonly",
        __dirname: "readonly",
      },
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];
