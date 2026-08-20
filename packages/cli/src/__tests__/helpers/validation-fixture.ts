import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { createGeneratorAtlasFixture } from "./fixture";
import { getRepoRoot } from "./run-cli";

export interface GeneratedSourceValidationFixture {
  root: string;
  stagingRoot: string;
  cleanup: () => void;
}

const STAGING_ROOT = path.join("apps/web/src", "__gen_validate__");

function ensureCommittedValidationTsconfig(repoRoot: string): string {
  const tsconfigPath = path.join(repoRoot, "apps/web/tsconfig.generated-validation.json");
  if (!existsSync(tsconfigPath)) {
    writeFileSync(
      tsconfigPath,
      `${JSON.stringify(
        {
          extends: "./tsconfig.json",
          include: ["src/__gen_validate__/**/*.ts", "src/__gen_validate__/**/*.tsx"],
          compilerOptions: {
            noEmit: true,
          },
        },
        null,
        2
      )}\n`,
      "utf8"
    );
  }

  return tsconfigPath;
}

export function createGeneratedSourceValidationFixture(): GeneratedSourceValidationFixture {
  const repoRoot = getRepoRoot();
  const fixture = createGeneratorAtlasFixture({ withContract: true, withReferencePaths: true });
  mkdirSync(path.join(repoRoot, STAGING_ROOT), { recursive: true });
  const stagingRoot = mkdtempSync(path.join(repoRoot, STAGING_ROOT, "run-"));

  return {
    root: fixture.root,
    stagingRoot,
    cleanup: () => {
      fixture.cleanup();
      if (existsSync(stagingRoot)) {
        rmSync(stagingRoot, { recursive: true, force: true });
      }
    },
  };
}

export function stageGeneratedOutput(
  fixture: GeneratedSourceValidationFixture,
  generatedRelativeRoot: string,
  stagingRelativeRoot: string
): void {
  copyGeneratedTree(
    path.join(fixture.root, "apps/web", generatedRelativeRoot),
    path.join(fixture.stagingRoot, stagingRelativeRoot)
  );
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
  stagingRelativePaths: string[]
): GeneratedSourceValidationResult {
  const repoRoot = getRepoRoot();
  const webRoot = path.join(repoRoot, "apps/web");
  ensureCommittedValidationTsconfig(repoRoot);
  const absolutePaths = stagingRelativePaths.map((relativePath) =>
    path.join(fixture.stagingRoot, relativePath)
  );

  const typecheck = spawnSync(
    "pnpm",
    ["exec", "tsc", "--noEmit", "-p", "tsconfig.generated-validation.json"],
    {
      cwd: webRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        NO_COLOR: "1",
        FORCE_COLOR: "0",
      },
    }
  );

  const eslintConfigPath = path.join(webRoot, "eslint.config.mjs");
  const eslint = spawnSync(
    "pnpm",
    ["exec", "eslint", "--config", eslintConfigPath, ...absolutePaths],
    {
      cwd: webRoot,
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
      path.join(repoRoot, ".prettierrc.json"),
      "--check",
      ...absolutePaths,
    ],
    {
      cwd: webRoot,
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

export function removeGeneratedSourceValidationFixture(
  fixture: GeneratedSourceValidationFixture
): void {
  fixture.cleanup();
}

export function readStagedGeneratedSource(
  fixture: GeneratedSourceValidationFixture,
  stagingRelativePath: string
): string {
  return readFileSync(path.join(fixture.stagingRoot, stagingRelativePath), "utf8");
}
