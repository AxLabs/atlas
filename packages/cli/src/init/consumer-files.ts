import { existsSync } from "node:fs";
import path from "node:path";

import {
  ATLAS_CONTRACT_FILENAME,
  DEFAULT_ATLAS_PROJECT_CONTRACT,
  LATEST_SCHEMA_VERSION,
  type RawAtlasProjectContract,
} from "@atlas/project";

import type { PlannedAction } from "../types/result";
import type { EnvPolicy } from "./types";

export const CONSUMER_NODE_ENGINE = ">=22.0.0";
export const CONSUMER_PNPM_ENGINE = ">=10.0.0";
export const CONSUMER_PACKAGE_MANAGER = "pnpm@10.19.0";

const CONSUMER_ROOT_DEV_DEPENDENCIES = {
  "@eslint/js": "^9.39.2",
  globals: "^16.5.0",
  prettier: "3.4.2",
  "prettier-plugin-tailwindcss": "0.6.10",
  turbo: "2.3.3",
} as const;

export function buildConsumerPackageManifest(options: {
  projectName: string;
  atlasVersion: string;
  includePerfCommands?: boolean;
}): string {
  const scripts: Record<string, string> = {
    preinstall: "node scripts/ensure-pnpm.js",
    dev: "turbo run dev",
    build: "turbo run build",
    lint: "turbo run lint",
    "lint:fix": "turbo run lint:fix",
    format: 'prettier --check "**/*.{ts,tsx,js,jsx,json,md,yml,yaml}"',
    "format:write": 'prettier --write "**/*.{ts,tsx,js,jsx,json,md,yml,yaml}"',
    "format:check": "turbo run format:check",
    typecheck: "turbo run typecheck",
    test: "turbo run test",
    "test:watch": "turbo run test:watch",
    "test:e2e": "turbo run test:e2e",
    clean: "turbo run clean && rm -rf node_modules",
    "api:gen": "pnpm --filter @atlas/web api:gen",
    "api:check": "pnpm api:gen && git diff --exit-code -- apps/web/src/lib/api/contracts/schema.ts",
    "template:check": "atlas sync infrastructure --check",
    "template:sync": "atlas sync infrastructure",
    atlas: "atlas",
    "validate:env": "pnpm --filter @atlas/web validate:env",
  };

  if (options.includePerfCommands) {
    scripts["perf:lhci"] = "pnpm --filter @atlas/web perf:lhci";
    scripts["perf:analyze"] = "pnpm --filter @atlas/web perf:analyze";
  }

  const manifest = {
    name: options.projectName,
    version: "0.1.0",
    private: true,
    license: "Apache-2.0",
    description: `Atlas application generated from Atlas ${options.atlasVersion}`,
    engines: {
      node: CONSUMER_NODE_ENGINE,
      pnpm: CONSUMER_PNPM_ENGINE,
    },
    packageManager: CONSUMER_PACKAGE_MANAGER,
    scripts,
    devDependencies: CONSUMER_ROOT_DEV_DEPENDENCIES,
  };

  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function buildConsumerReadme(options: {
  projectName: string;
  atlasVersion: string;
}): string {
  return `# ${options.projectName}

This project was generated from Atlas ${options.atlasVersion}.

## Getting started

\`\`\`bash
pnpm install
pnpm dev
pnpm atlas -- doctor
\`\`\`

\`pnpm atlas -- doctor\` uses the Atlas CLI on your \`PATH\` — the same installed CLI that created this project. Atlas is not published as a workspace package inside the generated repository.
`;
}

export function buildConsumerJestConfig(): string {
  return `/**
 * Root Jest configuration for the generated Atlas workspace.
 */
module.exports = {
  projects: ["<rootDir>/apps/web", "<rootDir>/packages/ui", "<rootDir>/packages/consent"],
  collectCoverageFrom: [
    "apps/*/src/**/*.{ts,tsx}",
    "packages/*/src/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/*.stories.tsx",
    "!**/index.ts",
    "!**/node_modules/**",
  ],
};
`;
}

export function buildConsumerContract(options: { repoRoot: string }): RawAtlasProjectContract {
  const specPath = path.join(
    options.repoRoot,
    DEFAULT_ATLAS_PROJECT_CONTRACT.generated.openApi.spec
  );
  const schemaPath = path.join(
    options.repoRoot,
    DEFAULT_ATLAS_PROJECT_CONTRACT.generated.openApi.schema
  );
  const hasOpenApi = existsSync(specPath) && existsSync(schemaPath);

  const contract: RawAtlasProjectContract = hasOpenApi
    ? { schemaVersion: LATEST_SCHEMA_VERSION }
    : {
        schemaVersion: LATEST_SCHEMA_VERSION,
        capabilities: {
          openApi: false,
        },
      };

  return contract;
}

export function planGeneratedAtInitActions(env: EnvPolicy): PlannedAction[] {
  const envTarget = path.posix.join(DEFAULT_ATLAS_PROJECT_CONTRACT.application.root, ".env.local");

  return [
    {
      kind: "create",
      path: ATLAS_CONTRACT_FILENAME,
      reason: "Generate Atlas project contract and platform.baseline checksums",
    },
    {
      kind: "create",
      path: "package.json",
      reason: "Generate consumer workspace manifest",
    },
    {
      kind: "skip",
      path: "pnpm-lock.yaml",
      reason:
        "Left absent until the consumer runs pnpm install; Atlas does not fabricate a lockfile",
    },
    {
      kind: "create",
      path: "README.md",
      reason: "Generate consumer-facing quickstart",
    },
    {
      kind: "create",
      path: "jest.config.js",
      reason: "Generate Jest projects for the materialized workspace",
    },
    env === "copy"
      ? {
          kind: "copy" as const,
          path: envTarget,
          reason: "Copy .env.example to .env.local",
        }
      : {
          kind: "skip" as const,
          path: envTarget,
          reason:
            "Environment setup skipped (--env skip); .env.example remains the documented template",
        },
  ];
}
