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

const POSTHOG_IMPORT_PATHS = [
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
];

const ENV_IMPORT_PATTERNS = [
  {
    group: ["@/env", "@/env/*"],
    message:
      "Direct env imports are discouraged. Use the config facade instead:\n" +
      "  - Server-side: import { getServerConfig } from '@/config'\n" +
      "  - Client-side: import { useConfig } from '@/config'\n" +
      "This provides a stable, typed config interface and separates concerns.",
  },
];

const UI_INTERNAL_ALIAS_PATTERNS = [
  {
    group: ["@/lib/utils", "@/lib/utils/*", "@/hooks/use-zod-form", "@/hooks/use-theme"],
    message:
      "Do not import @atlas/ui internals via app aliases. Use the public API:\n" +
      "  import { cn, useZodForm, useTheme } from '@atlas/ui';",
  },
];

const PACKAGE_SOURCE_PATTERNS = [
  {
    group: ["**/packages/ui/**", "**/packages/consent/**", "../../packages/**"],
    message:
      "Do not import workspace package source directly. Use public package exports:\n" +
      "  import { Button } from '@atlas/ui';\n" +
      "  import '@atlas/ui/globals.css';",
  },
];

/** Standard app import policy: env facade, analytics adapters, UI public API, package source. */
const STANDARD_APP_IMPORT_RESTRICTIONS = {
  paths: POSTHOG_IMPORT_PATHS,
  patterns: [...ENV_IMPORT_PATTERNS, ...UI_INTERNAL_ALIAS_PATTERNS, ...PACKAGE_SOURCE_PATTERNS],
};

/** API route import policy: same boundaries except direct @/env imports (route handlers may read env). */
const API_ROUTE_IMPORT_RESTRICTIONS = {
  paths: POSTHOG_IMPORT_PATHS,
  patterns: [...UI_INTERNAL_ALIAS_PATTERNS, ...PACKAGE_SOURCE_PATTERNS],
};

/** lib/providers import policy: no analytics vendor ban (adapters live in lib). */
const LIB_PROVIDER_IMPORT_RESTRICTIONS = {
  patterns: [...ENV_IMPORT_PATTERNS, ...UI_INTERNAL_ALIAS_PATTERNS, ...PACKAGE_SOURCE_PATTERNS],
};

/** Config/env implementation: package boundaries without @/env self-import ban. */
const CONFIG_IMPORT_RESTRICTIONS = {
  patterns: [...UI_INTERNAL_ALIAS_PATTERNS, ...PACKAGE_SOURCE_PATTERNS],
};

/**
 * File policy classes — each group is mutually exclusive and carries the complete
 * effective rule set for that class. Do not union unrelated exception lists on one object.
 */

/** App/component/feature/provider files under the standard import + syntax policy. */
const STANDARD_APP_LAYER_FILES = [
  "src/app/**/*.{ts,tsx}",
  "src/components/**/*.{ts,tsx}",
  "src/features/**/*.{ts,tsx}",
  "src/providers/**/*.{ts,tsx}",
];

/** Excluded from the standard app-layer syntax block (each has its own syntax policy). */
const SPECIAL_APP_LAYER_SYNTAX_IGNORES = [
  "src/app/api/**/route.ts",
  "src/app/monitoring/route.ts",
  "src/app/monitoring/eslint-boundaries/route.ts",
  "src/providers/analytics-provider.tsx",
  "src/providers/eslint-boundaries/analytics-provider-fixture.tsx",
];

const STANDARD_APP_IMPORT_FILES = [
  "src/app/**/*.{ts,tsx}",
  "src/components/**/*.{ts,tsx}",
  "src/features/**/*.{ts,tsx}",
  "src/hooks/**/*.{ts,tsx}",
];

const STANDARD_APP_IMPORT_IGNORES = [
  "src/config/**",
  "src/app/api/**/route.ts",
  ...TEST_FILE_IGNORES,
];

const API_ROUTE_FILES = ["src/app/api/**/route.ts"];

const MONITORING_ROUTE_FILES = [
  "src/app/monitoring/route.ts",
  "src/app/monitoring/eslint-boundaries/route.ts",
];

const ANALYTICS_PROVIDER_FILES = [
  "src/providers/analytics-provider.tsx",
  "src/providers/eslint-boundaries/analytics-provider-fixture.tsx",
];

const CONFIG_ENV_FILES = ["src/env.ts", "src/env/**", "src/schemas/env/**", "src/config/**"];

const PROCESS_ENV_ALLOWED_FILES = [
  ...CONFIG_ENV_FILES,
  "src/app/api/**/route.ts",
  "src/lib/analytics/adapters/**",
  ...ANALYTICS_PROVIDER_FILES,
  ...TEST_FILE_IGNORES,
];

function processEnvSyntaxRule() {
  return {
    selector: PROCESS_ENV_SELECTOR,
    message: PROCESS_ENV_MESSAGE,
  };
}

function fetchSyntaxRules() {
  return {
    "no-restricted-syntax": [
      "error",
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
  };
}

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
      "src/app/api/eslint-boundaries/**",
      "src/app/monitoring/eslint-boundaries/**",
      "src/providers/eslint-boundaries/**",
      "src/lib/analytics/adapters/eslint-boundaries/**",
    ],
  },
  {
    // Standard app import policy
    files: STANDARD_APP_IMPORT_FILES,
    ignores: STANDARD_APP_IMPORT_IGNORES,
    rules: {
      "no-restricted-imports": ["error", STANDARD_APP_IMPORT_RESTRICTIONS],
    },
  },
  {
    // API route import policy — env imports allowed; other boundaries remain
    files: API_ROUTE_FILES,
    ignores: TEST_FILE_IGNORES,
    rules: {
      "no-restricted-imports": ["error", API_ROUTE_IMPORT_RESTRICTIONS],
    },
  },
  {
    // Config/env implementation — no @/env self-import ban; package boundaries remain
    files: CONFIG_ENV_FILES,
    ignores: TEST_FILE_IGNORES,
    rules: {
      "no-restricted-imports": ["error", CONFIG_IMPORT_RESTRICTIONS],
    },
  },
  {
    // lib/providers import policy — analytics vendor SDKs allowed in adapters
    files: ["src/providers/**/*.{ts,tsx}", "src/lib/**/*.{ts,tsx}"],
    ignores: [...CONFIG_ENV_FILES, ...TEST_FILE_IGNORES],
    rules: {
      "no-restricted-imports": ["error", LIB_PROVIDER_IMPORT_RESTRICTIONS],
    },
  },
  {
    // Non-app-layer src: process.env only (lib, hooks, etc.)
    files: ["src/**/*.{ts,tsx}"],
    ignores: [...PROCESS_ENV_ALLOWED_FILES, ...STANDARD_APP_LAYER_FILES],
    rules: {
      "no-restricted-syntax": ["error", processEnvSyntaxRule()],
    },
  },
  {
    // Standard app-layer syntax policy — process.env and raw fetch both banned
    files: STANDARD_APP_LAYER_FILES,
    ignores: [...SPECIAL_APP_LAYER_SYNTAX_IGNORES, ...TEST_FILE_IGNORES],
    rules: {
      "no-restricted-syntax": [
        "error",
        processEnvSyntaxRule(),
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
    // Monitoring route policy — raw fetch allowed; process.env still banned
    files: MONITORING_ROUTE_FILES,
    rules: {
      "no-restricted-syntax": ["error", processEnvSyntaxRule()],
    },
  },
  {
    // Analytics provider policy — process.env allowed; raw fetch still banned
    files: ANALYTICS_PROVIDER_FILES,
    rules: fetchSyntaxRules(),
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
