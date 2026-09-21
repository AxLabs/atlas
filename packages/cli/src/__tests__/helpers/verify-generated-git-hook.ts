import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { getRepoRoot } from "./run-cli";

function run(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...env,
      NO_COLOR: "1",
      FORCE_COLOR: "0",
    },
  });
  if (result.error) {
    throw result.error;
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function expectSuccess(
  command: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv
): void {
  const result = run(command, args, cwd, env);
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed (${result.status})\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
  }
}

/**
 * Prove the generated Husky + lint-staged hook actually lints staged workspace files.
 * A HOOK_RAN marker is not sufficient.
 */
export function verifyGeneratedGitHook(generatedRoot: string): void {
  const repoRoot = getRepoRoot();
  const fixture = mkdtempSync(path.join(os.tmpdir(), "atlas-git-hook-"));
  const hookEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${path.join(fixture, "node_modules/.bin")}${path.delimiter}${process.env.PATH ?? ""}`,
  };
  delete hookEnv.HUSKY;
  delete hookEnv.HUSKY_SKIP_HOOKS;

  try {
    mkdirSync(path.join(fixture, "apps/web/src"), { recursive: true });
    mkdirSync(path.join(fixture, "scripts"), { recursive: true });
    mkdirSync(path.join(fixture, ".husky"), { recursive: true });
    mkdirSync(path.join(fixture, "node_modules"), { recursive: true });

    writeFileSync(
      path.join(fixture, "package.json"),
      `${JSON.stringify(
        {
          name: "atlas-hook-fixture",
          private: true,
          type: "module",
          scripts: { prepare: "husky" },
          devDependencies: {
            eslint: "9.17.0",
            husky: "9.1.7",
            "lint-staged": "15.2.10",
          },
        },
        null,
        2
      )}\n`
    );
    writeFileSync(
      path.join(fixture, "apps/web/package.json"),
      `${JSON.stringify({ name: "@atlas/web", private: true }, null, 2)}\n`
    );
    writeFileSync(
      path.join(fixture, "apps/web/eslint.config.mjs"),
      `export default [
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: { "no-console": "error" },
  },
];
`
    );
    copyFileSync(
      path.join(generatedRoot, "lint-staged.config.mjs"),
      path.join(fixture, "lint-staged.config.mjs")
    );
    copyFileSync(
      path.join(generatedRoot, "scripts/lint-staged-utils.mjs"),
      path.join(fixture, "scripts/lint-staged-utils.mjs")
    );
    copyFileSync(
      path.join(generatedRoot, "scripts/lint-staged-eslint.mjs"),
      path.join(fixture, "scripts/lint-staged-eslint.mjs")
    );
    copyFileSync(
      path.join(generatedRoot, ".husky/pre-commit"),
      path.join(fixture, ".husky/pre-commit")
    );
    chmodSync(path.join(fixture, ".husky/pre-commit"), 0o755);
    symlinkSync(path.join(repoRoot, "node_modules/.bin"), path.join(fixture, "node_modules/.bin"));

    expectSuccess("git", ["init"], fixture, hookEnv);
    expectSuccess("git", ["config", "core.hooksPath", ".husky"], fixture, hookEnv);

    writeFileSync(path.join(fixture, "README.md"), "fixture\n");
    writeFileSync(path.join(fixture, "notes.txt"), "keep\n");
    expectSuccess("git", ["add", "README.md", "notes.txt"], fixture, hookEnv);
    expectSuccess(
      "git",
      [
        "-c",
        "user.name=Atlas Test",
        "-c",
        "user.email=atlas-test@example.com",
        "commit",
        "--no-gpg-sign",
        "-m",
        "chore: initial commit",
      ],
      fixture,
      hookEnv
    );

    const violatingPath = path.join(fixture, "apps/web/src/page.tsx");
    writeFileSync(violatingPath, "export const value = 1;\nconsole.log(value);\n");
    expectSuccess("git", ["add", "apps/web/src/page.tsx"], fixture, hookEnv);
    writeFileSync(violatingPath, "export const value = 1;\n");
    writeFileSync(path.join(fixture, "notes.txt"), "unstaged notes\n");

    const blocked = run(
      "git",
      [
        "-c",
        "user.name=Atlas Test",
        "-c",
        "user.email=atlas-test@example.com",
        "commit",
        "--no-gpg-sign",
        "-m",
        "test: lint-staged should block",
      ],
      fixture,
      hookEnv
    );
    if (blocked.status === 0) {
      throw new Error(
        `expected the generated hook to block a workspace lint violation\nstdout:\n${blocked.stdout}\nstderr:\n${blocked.stderr}`
      );
    }
    const blockedOutput = `${blocked.stdout}\n${blocked.stderr}`;
    if (!/no-console|eslint/i.test(blockedOutput)) {
      throw new Error(
        `blocked commit did not report an ESLint violation\nstdout:\n${blocked.stdout}\nstderr:\n${blocked.stderr}`
      );
    }
    const stagedAfterFailure = run("git", ["show", ":apps/web/src/page.tsx"], fixture, hookEnv);
    if (!stagedAfterFailure.stdout.includes("console.log")) {
      throw new Error(
        `failed hook did not preserve the invalid staged copy\nstdout:\n${stagedAfterFailure.stdout}`
      );
    }
    if (readFileSync(violatingPath, "utf8") !== "export const value = 1;\n") {
      throw new Error("failed hook did not preserve the corrected unstaged working copy");
    }
    if (readFileSync(path.join(fixture, "notes.txt"), "utf8") !== "unstaged notes\n") {
      throw new Error("failed hook did not preserve unrelated unstaged changes");
    }

    writeFileSync(violatingPath, "export const value = 1;\n");
    writeFileSync(path.join(fixture, "notes.txt"), "keep\n");
    expectSuccess("git", ["add", "apps/web/src/page.tsx"], fixture, hookEnv);
    writeFileSync(violatingPath, "export const value = 1;\nconsole.log(value);\n");
    const passed = run(
      "git",
      [
        "-c",
        "user.name=Atlas Test",
        "-c",
        "user.email=atlas-test@example.com",
        "commit",
        "--no-gpg-sign",
        "-m",
        "test: lint-staged should pass",
      ],
      fixture,
      hookEnv
    );
    if (passed.status !== 0) {
      throw new Error(
        `corrected commit should pass\nstdout:\n${passed.stdout}\nstderr:\n${passed.stderr}`
      );
    }
    const committed = run("git", ["show", "HEAD:apps/web/src/page.tsx"], fixture, hookEnv);
    if (committed.stdout !== "export const value = 1;\n") {
      throw new Error(`commit included unstaged edits:\n${committed.stdout}`);
    }
    if (readFileSync(violatingPath, "utf8") !== "export const value = 1;\nconsole.log(value);\n") {
      throw new Error("valid commit did not leave the invalid unstaged edit in the working tree");
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}
