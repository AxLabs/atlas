import baseConfig from "@atlas/config/eslint";

export default [
  ...baseConfig,
  {
    files: ["src/lib/telemetry/**/*.ts", "src/lib/telemetry/**/*.tsx"],
    ignores: ["**/__tests__/**"],
    rules: {
      // These files are browser-only with proper type guards
      "no-undef": "off",
    },
  },
  {
    files: ["next.config.js", "jest.config.js", "jest.setup.js"],
    rules: {
      // Config files require CommonJS
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["jest.setup.js", "**/__tests__/**/*.ts", "**/__tests__/**/*.tsx"],
    rules: {
      // Jest test files use globals
      "no-undef": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];
