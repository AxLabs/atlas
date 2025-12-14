module.exports = {
  ...require("@thedanielmark/config/jest"),
  roots: ["<rootDir>/src"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
};
