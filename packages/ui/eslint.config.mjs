import baseConfig from "@atlas/config/eslint";

export default [
  ...baseConfig,
  {
    files: ["**/*.stories.tsx", "**/*.stories.ts", "**/*.stories.jsx", "**/*.stories.js"],
    rules: {
      // Storybook stories can use console for examples
      "no-console": "off",
    },
  },
];
