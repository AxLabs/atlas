import baseConfig from "@atlas/config/eslint";

export default [
  ...baseConfig,
  {
    // Ban console.* usage - use structured logging instead
    rules: {
      "no-console": "error",
    },
  },
  {
    files: ["src/lib/telemetry/**/*.ts", "src/lib/telemetry/**/*.tsx", "src/app/api/telemetry/**/*.ts"],
    ignores: ["**/__tests__/**"],
    rules: {
      // These files are browser-only with proper type guards
      "no-undef": "off",
      // Telemetry uses console for browser-side debugging
      "no-console": "off",
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
    files: ["scripts/**/*.ts", "scripts/**/*.js"],
    rules: {
      // Scripts are allowed to use console for user feedback
      "no-console": "off",
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
