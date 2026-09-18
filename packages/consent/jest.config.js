/* eslint-disable @typescript-eslint/no-require-imports */
module.exports = {
  ...require("@atlas/config/jest"),
  roots: ["<rootDir>/src"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  // Consent is not the UI package: do not inherit shadcn-component exclusions or UI floors.
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
    "!src/**/__tests__/**",
  ],
  coverageThreshold: {},
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    "^react$": require.resolve("react"),
    "^react-dom$": require.resolve("react-dom"),
    "^react/jsx-runtime$": require.resolve("react/jsx-runtime"),
  },
};
