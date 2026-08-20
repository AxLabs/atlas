import baseConfig from "@atlas/config/eslint";
import tseslint from "typescript-eslint";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Shared test file ignores for architecture boundary rules. */
const TEST_FILE_IGNORES = [
  "src/test/**",
  "**/__tests__/**",
  "**/*.test.{ts,tsx}",
  "**/*.spec.{ts,tsx}",
];

/** Files where direct @/env imports are banned (config facade required). */
const ENV_IMPORT_IGNORES = [
  "src/config/**",
  "src/app/api/**/route.ts",
  ...TEST_FILE_IGNORES,
];

/** Files where raw fetch() is banned (central API client required). */
const NO_FETCH_IGNORES = [
  "src/lib/api/**",
  "src/lib/http/**",
  "src/app/api/**/route.ts",
  "src/app/monitoring/route.ts",
];

/** Files where both process.env and fetch restrictions apply together. */
const APP_LAYER_FILES = [
  "src/app/**/*.{ts,tsx}",
  "src/components/**/*.{ts,tsx}",
  "src/features/**/*.{ts,tsx}",
  "src/providers/**/*.{ts,tsx}",
];

const PROCESS_ENV_IGNORES = [
  "src/env.ts",
  "src/env/**",
  "src/schemas/env/**",
  "src/config/**",
  "src/app/api/**/route.ts",
  "src/lib/analytics/adapters/**",
  "src/providers/analytics-provider.tsx",
  ...TEST_FILE_IGNORES,
];

const PROCESS_ENV_MESSAGE =
  "Direct access to process.env is not allowed. Use the config facade instead:\n" +
  "  - Server-side: import { getServerConfig } from '@/config'\n" +
  "  - Client-side: import { useConfig } from '@/config'\n" +
  "This ensures type safety, validation, and consistent config access patterns.";

const PROCESS_ENV_SELECTOR =
  "MemberExpression[object.name='process'][property.name='env']";

const FETCH_MESSAGE =
  "Direct fetch() calls are not allowed. Use the central API client from @/lib/api instead. " +
  "This ensures consistent error handling, correlation ID propagation, and retry logic.";

/** Combined import restrictions for app layers that also ban analytics vendor SDKs. */
const APP_LAYER_IMPORT_RESTRICTIONS = {
  paths: [
    {
      name: "posthog-js",
      message:
        "Direct PostHog imports are not allowed. Use the analytics adapter instead:\n" +
        "  import { analytics } from '@/lib/analytics';\n" +
        "This ensures consistent event tracking and consent management.",
    },
    {
      name: "posthog-js/react",
      message:
        "Direct PostHog imports are not allowed. Use the analytics adapter instead:\n" +
        "  import { analytics } from '@/lib/analytics';\n" +
        "This ensures consistent event tracking and consent management.",
    },
  ],
  patterns: [
    {
      group: ["@/env", "@/env/*"],
      message:
        "Direct env imports are discouraged. Use the config facade instead:\n" +
        "  - Server-side: import { getServerConfig } from '@/config'\n" +
        "  - Client-side: import { useConfig } from '@/config'\n" +
        "This provides a stable, typed config interface and separates concerns.",
    },
    {
      group: ["@/lib/utils", "@/lib/utils/*", "@/hooks/use-zod-form", "@/hooks/use-theme"],
      message:
        "Do not import @atlas/ui internals via app aliases. Use the public API:\n" +
        "  import { cn, useZodForm, useTheme } from '@atlas/ui';",
    },
    {
      group: ["**/packages/ui/**", "**/packages/consent/**", "../../packages/**"],
      message:
        "Do not import workspace package source directly. Use public package exports:\n" +
        "  import { Button } from '@atlas/ui';\n" +
        "  import '@atlas/ui/globals.css';",
    },
  ],
};

/** Import restrictions for lib/providers (no analytics vendor ban — adapters live in lib). */
const LIB_PROVIDER_IMPORT_RESTRICTIONS = {
  patterns: APP_LAYER_IMPORT_RESTRICTIONS.patterns,
};

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
    ignores: [
      "eslint.config.mjs",
      "eslint.boundaries.test.mjs",
      "src/components/eslint-boundaries/**",
      "src/lib/eslint-boundaries/**",
    ],
  },
  {
    // App layers: env facade, analytics adapters, UI public API, and package source boundaries
    files: [
      "src/app/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/features/**/*.{ts,tsx}",
      "src/hooks/**/*.{ts,tsx}",
    ],
    ignores: ENV_IMPORT_IGNORES,
    rules: {
      "no-restricted-imports": ["error", APP_LAYER_IMPORT_RESTRICTIONS],
    },
  },
  {
    // lib/providers: same import boundaries except analytics vendor SDKs (adapters live here)
    files: ["src/providers/**/*.{ts,tsx}", "src/lib/**/*.{ts,tsx}"],
    ignores: ENV_IMPORT_IGNORES,
    rules: {
      "no-restricted-imports": ["error", LIB_PROVIDER_IMPORT_RESTRICTIONS],
    },
  },
  {
    // Ban direct process.env in src files not covered by the app-layer combined block below
    files: ["src/**/*.{ts,tsx}"],
    ignores: [...PROCESS_ENV_IGNORES, ...APP_LAYER_FILES],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: PROCESS_ENV_SELECTOR,
          message: PROCESS_ENV_MESSAGE,
        },
      ],
    },
  },
  {
    // App layers: process.env + raw fetch restrictions in one rule (flat-config safe)
    files: APP_LAYER_FILES,
    ignores: [...PROCESS_ENV_IGNORES, ...NO_FETCH_IGNORES],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: PROCESS_ENV_SELECTOR,
          message: PROCESS_ENV_MESSAGE,
        },
        {
          selector: "CallExpression[callee.name='fetch']",
          message: FETCH_MESSAGE,
        },
      ],
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message: FETCH_MESSAGE,
        },
      ],
    },
  },
  {
    // Ban console.* usage - use structured logging instead
    rules: {
      "no-console": "error",
    },
  },
  {
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
