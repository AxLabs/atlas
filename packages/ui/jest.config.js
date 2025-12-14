/* eslint-disable @typescript-eslint/no-require-imports */
module.exports = {
  ...require("@atlas/config/jest"),
  roots: ["<rootDir>/src"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
};
