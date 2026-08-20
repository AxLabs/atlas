import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { createGeneratorAtlasFixture } from "./fixture";
import { getRepoRoot } from "./run-cli";

export const GEN_VALIDATION_FEATURE_PREFIX = "__gen-validation";
export const GEN_VALIDATION_APP_PREFIX = "__gen-validation";

export interface GeneratedSourceValidationFixture {
  root: string;
  runId: string;
  repoRoot: string;
  webRoot: string;
  tsconfigPath: string;
  cleanup: () => void;
}

function createRunId(): string {
  return `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getGeneratedValidationFeatureRoot(runId: string, featureName: string): string {
  return path.join(
    "apps/web/src/features",
    `${GEN_VALIDATION_FEATURE_PREFIX}-${runId}-${featureName}`
  );
}

export function getGeneratedValidationAppRoot(runId: string, appRoute: string): string {
  return path.join("apps/web/src/app", `${GEN_VALIDATION_APP_PREFIX}-${runId}`, appRoute);
}

function collectSourceFiles(absoluteRoot: string): string[] {
  if (!existsSync(absoluteRoot)) {
    return [];
  }

  const files: string[] = [];

  function walk(current: string): void {
    for (const entry of readdirSync(current)) {
      const absoluteEntry = path.join(current, entry);
      if (statSync(absoluteEntry).isDirectory()) {
        walk(absoluteEntry);
        continue;
      }

      if (/\.(ts|tsx)$/.test(entry)) {
        files.push(absoluteEntry);
      }
    }
  }

  walk(absoluteRoot);
  return files;
}

function writeRunValidationTsconfig(
  webRoot: string,
  runId: string,
  includeRelativePaths: string[]
): string {
  const tsconfigPath = path.join(webRoot, `.gen-validation-${runId}.json`);
  const include = [
    "generated-validation-env.d.ts",
    ...includeRelativePaths.map((relativePath) =>
      path.posix.join(relativePath.replace(/\\/g, "/"), "**/*")
    ),
  ];

  writeFileSync(
    tsconfigPath,
    `${JSON.stringify(
      {
        extends: "./tsconfig.json",
        include,
        compilerOptions: {
          noEmit: true,
          types: ["node", "jest", "@testing-library/jest-dom"],
        },
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return tsconfigPath;
}

function cleanupGeneratedValidationRun(webRoot: string, runId: string): void {
  const tsconfigPath = path.join(webRoot, `.gen-validation-${runId}.json`);
  if (existsSync(tsconfigPath)) {
    rmSync(tsconfigPath, { force: true });
  }

  const featuresDir = path.join(webRoot, "src/features");
  if (existsSync(featuresDir)) {
    for (const entry of readdirSync(featuresDir)) {
      if (entry.startsWith(`${GEN_VALIDATION_FEATURE_PREFIX}-${runId}-`)) {
        rmSync(path.join(featuresDir, entry), { recursive: true, force: true });
      }
    }
  }

  const appValidationRoot = path.join(webRoot, "src/app", `${GEN_VALIDATION_APP_PREFIX}-${runId}`);
  if (existsSync(appValidationRoot)) {
    rmSync(appValidationRoot, { recursive: true, force: true });
  }
}

export function createGeneratedSourceValidationFixture(): GeneratedSourceValidationFixture {
  const repoRoot = getRepoRoot();
  const webRoot = path.join(repoRoot, "apps/web");
  const runId = createRunId();
  const fixture = createGeneratorAtlasFixture({ withContract: true, withReferencePaths: true });
  const tsconfigPath = writeRunValidationTsconfig(webRoot, runId, []);

  return {
    root: fixture.root,
    runId,
    repoRoot,
    webRoot,
    tsconfigPath,
    cleanup: () => {
      fixture.cleanup();
      cleanupGeneratedValidationRun(webRoot, runId);
    },
  };
}

export interface StageGeneratedOutputOptions {
  generatedRelativeRoot: string;
  kind: "feature" | "app";
  name: string;
}

export function stageGeneratedOutput(
  fixture: GeneratedSourceValidationFixture,
  options: StageGeneratedOutputOptions
): string[] {
  const sourceRoot = path.join(fixture.root, "apps/web", options.generatedRelativeRoot);

  const destinationRelative =
    options.kind === "feature"
      ? path.join(
          "src/features",
          `${GEN_VALIDATION_FEATURE_PREFIX}-${fixture.runId}-${options.name}`
        )
      : path.join("src/app", `${GEN_VALIDATION_APP_PREFIX}-${fixture.runId}`, options.name);
  const destinationRoot = path.join(fixture.webRoot, destinationRelative);

  copyGeneratedTree(sourceRoot, destinationRoot);

  fixture.tsconfigPath = writeRunValidationTsconfig(fixture.webRoot, fixture.runId, [
    destinationRelative,
  ]);

  return collectSourceFiles(destinationRoot);
}

function copyGeneratedTree(sourceRoot: string, destinationRoot: string): void {
  if (!existsSync(sourceRoot)) {
    return;
  }

  cpSync(sourceRoot, destinationRoot, { recursive: true });
}

export interface GeneratedSourceValidationResult {
  typecheck: { exitCode: number | null; stderr: string; stdout: string };
  eslint: { exitCode: number | null; stderr: string; stdout: string };
  prettier: { exitCode: number | null; stderr: string; stdout: string };
}

export function validateGeneratedWebSource(
  fixture: GeneratedSourceValidationFixture,
  absolutePaths: string[]
): GeneratedSourceValidationResult {
  const eslintConfigPath = path.join(fixture.webRoot, "eslint.config.mjs");

  const typecheck = spawnSync("pnpm", ["exec", "tsc", "--noEmit", "-p", fixture.tsconfigPath], {
    cwd: fixture.webRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      NO_COLOR: "1",
      FORCE_COLOR: "0",
    },
  });

  const eslint = spawnSync(
    "pnpm",
    ["exec", "eslint", "--config", eslintConfigPath, ...absolutePaths],
    {
      cwd: fixture.webRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        NO_COLOR: "1",
        FORCE_COLOR: "0",
      },
    }
  );

  const prettier = spawnSync(
    "pnpm",
    [
      "exec",
      "prettier",
      "--config",
      path.join(fixture.repoRoot, ".prettierrc.json"),
      "--check",
      ...absolutePaths,
    ],
    {
      cwd: fixture.webRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        NO_COLOR: "1",
        FORCE_COLOR: "0",
      },
    }
  );

  return {
    typecheck: {
      exitCode: typecheck.status,
      stderr: typecheck.stderr,
      stdout: typecheck.stdout,
    },
    eslint: {
      exitCode: eslint.status,
      stderr: eslint.stderr,
      stdout: eslint.stdout,
    },
    prettier: {
      exitCode: prettier.status,
      stderr: prettier.stderr,
      stdout: prettier.stdout,
    },
  };
}

export function writeGeneratedValidationFeatureFile(
  fixture: GeneratedSourceValidationFixture,
  featureName: string,
  relativeFile: string,
  content: string
): string {
  const featureRelative = path.join(
    "src/features",
    `${GEN_VALIDATION_FEATURE_PREFIX}-${fixture.runId}-${featureName}`
  );
  const featureRoot = path.join(fixture.webRoot, featureRelative);
  const absolutePath = path.join(featureRoot, relativeFile);

  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content, "utf8");

  fixture.tsconfigPath = writeRunValidationTsconfig(fixture.webRoot, fixture.runId, [
    featureRelative,
  ]);

  return absolutePath;
}

export function removeGeneratedSourceValidationFixture(
  fixture: GeneratedSourceValidationFixture
): void {
  fixture.cleanup();
}

export function readStagedGeneratedSource(absolutePath: string): string {
  return readFileSync(absolutePath, "utf8");
}
