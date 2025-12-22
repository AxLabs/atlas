import baseConfig from "@atlas/config/eslint";
import tseslint from "typescript-eslint";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default [
  ...baseConfig,
  {
    // Override parser options to specify this package's tsconfig
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        tsconfigRootDir: __dirname,
        project: "./tsconfig.json",
      },
    },
  },
  {
    ignores: ["eslint.config.mjs"], // Don't lint the config file itself
  },
  {
    // Ban console.* usage - use structured logging instead
    rules: {
      "no-console": "error",
    },
  },
  {
    // Enforce "no fetch spaghetti" - all API calls go through central client
    files: [
      "src/app/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/features/**/*.{ts,tsx}",
      "src/providers/**/*.{ts,tsx}",
    ],
    ignores: [
      "src/lib/api/**",
      "src/lib/http/**",
      "src/app/api/**/route.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='fetch']",
          message:
            "Direct fetch() calls are not allowed. Use the central API client from @/lib/api instead. This ensures consistent error handling, correlation ID propagation, and retry logic.",
        },
      ],
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message:
            "Direct fetch() calls are not allowed. Use the central API client from @/lib/api instead. This ensures consistent error handling, correlation ID propagation, and retry logic.",
        },
      ],
    },
  },
  {
    // Auto-generated OpenAPI schema files
    files: ["src/lib/api/contracts/schema.ts"],
    rules: {
      // Generated code doesn't follow our naming conventions
      "@typescript-eslint/naming-convention": "off",
      // Generated code uses index signatures instead of Record
      "@typescript-eslint/consistent-indexed-object-style": "off",
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
    files: ["next.config.js", "jest.config.js", "jest.setup.js", "postcss.config.mjs", "eslint.config.mjs", "playwright.config.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false, // These files are not in tsconfig
      },
      globals: {
        process: "readonly",
        __dirname: "readonly",
      },
    },
    rules: {
      // Config files require CommonJS
      "@typescript-eslint/no-require-imports": "off",
      // Disable type-checked rules for non-TS files
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "no-undef": "off",
    },
  },
  {
    files: ["scripts/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
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
