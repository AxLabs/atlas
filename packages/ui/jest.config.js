/* eslint-disable @typescript-eslint/no-require-imports */
const baseConfig = require("@atlas/config/jest");

module.exports = {
  ...baseConfig,
  roots: ["<rootDir>/src"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  collectCoverageFrom: [...baseConfig.collectCoverageFrom, "!src/extended.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    // Force single React version (fixes "React Element from older version" error)
    "^react$": require.resolve("react"),
    "^react-dom$": require.resolve("react-dom"),
    "^react/jsx-runtime$": require.resolve("react/jsx-runtime"),
  },
};
