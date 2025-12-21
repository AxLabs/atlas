module.exports = {
  displayName: "web",
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  roots: ["<rootDir>/src"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
  },
  testMatch: ["**/__tests__/**/*.test.ts?(x)", "**/?(*.)+(spec|test).ts?(x)"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        isolatedModules: true,
        useESM: false,
        tsconfig: {
          jsx: "react-jsx",
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          module: "commonjs",
        },
      },
    ],
  },
  transformIgnorePatterns: ["node_modules/(?!(web-vitals)/)"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.stories.tsx",
    "!src/**/index.ts",
    "!src/app/**/layout.tsx",
    "!src/app/**/page.tsx",
  ],
};
