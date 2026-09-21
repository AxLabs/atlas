import assert from "node:assert/strict";
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
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildEslintCommand,
  buildEslintInvocations,
  buildPrettierCommand,
  ESLINT_PACKAGES,
  groupByEslintRoot,
  parseLintStagedFilenames,
  quote,
  toRepoRelativePosix,
} from "../lint-staged-utils.mjs";

const ROOT = "/repo";
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("quote", () => {
  it("wraps paths in double quotes", () => {
    assert.equal(quote("apps/web/src/page.tsx"), '"apps/web/src/page.tsx"');
  });

  it("escapes embedded double quotes", () => {
    assert.equal(quote('apps/web/"weird".tsx'), '"apps/web/\\"weird\\".tsx"');
  });

  it("handles paths with spaces", () => {
    assert.equal(quote("apps/web/my file.tsx"), '"apps/web/my file.tsx"');
  });
});

describe("toRepoRelativePosix", () => {
  it("normalizes absolute lint-staged filenames before grouping", () => {
    assert.equal(
      toRepoRelativePosix(path.join(ROOT, "apps/web/src/page.tsx"), ROOT),
      "apps/web/src/page.tsx",
    );
  });
});

describe("groupByEslintRoot", () => {
  it("groups files by workspace eslint root", () => {
    const { groups, rootFiles } = groupByEslintRoot(
      [
        "apps/web/src/page.tsx",
        "packages/ui/src/button.tsx",
        "packages/consent/src/index.ts",
        "packages/config/eslint.config.mjs",
        "scripts/foo.mjs",
      ],
      ESLINT_PACKAGES,
      ROOT,
    );

    assert.deepEqual(rootFiles, ["scripts/foo.mjs"]);
    assert.equal(groups.get("apps/web")?.length, 1);
    assert.equal(groups.get("packages/ui")?.length, 1);
    assert.equal(groups.get("packages/consent")?.length, 1);
    assert.equal(groups.get("packages/config")?.length, 1);
  });

  it("normalizes absolute paths and Windows separators", () => {
    const { groups } = groupByEslintRoot(
      [path.join(ROOT, "apps/web/src/page.tsx"), "apps\\web\\src\\other.tsx"],
      ESLINT_PACKAGES,
      ROOT,
    );
    assert.deepEqual(groups.get("apps/web"), ["apps/web/src/page.tsx", "apps/web/src/other.tsx"]);
  });

  it("covers every configured eslint package", () => {
    for (const packageDir of ESLINT_PACKAGES) {
      const { groups } = groupByEslintRoot([`${packageDir}/file.ts`], ESLINT_PACKAGES, ROOT);
      assert.equal(groups.get(packageDir)?.[0], `${packageDir}/file.ts`);
    }
  });
});

describe("buildEslintInvocations", () => {
  it("runs eslint from each workspace directory without a shell cd", () => {
    const invocations = buildEslintInvocations(
      ["apps/web/src/page.tsx", "packages/ui/src/input.tsx"],
      { cwd: ROOT },
    );

    assert.deepEqual(invocations, [
      { cwd: "apps/web", args: ["--fix", "--", "src/page.tsx"] },
      { cwd: "packages/ui", args: ["--fix", "--", "src/input.tsx"] },
    ]);
  });

  it("groups absolute lint-staged filenames into workspace invocations", () => {
    const invocations = buildEslintInvocations([path.join(ROOT, "apps/web/src/page.tsx")], {
      cwd: ROOT,
    });

    assert.deepEqual(invocations, [{ cwd: "apps/web", args: ["--fix", "--", "src/page.tsx"] }]);
  });

  it("lints root-level files with the root eslint config", () => {
    const invocations = buildEslintInvocations(["scripts/foo.mjs"], { cwd: ROOT });
    assert.deepEqual(invocations, [{ cwd: ".", args: ["--fix", "--", "scripts/foo.mjs"] }]);
  });

  it("keeps filenames with spaces as single argv entries", () => {
    const invocations = buildEslintInvocations(["apps/web/my file.tsx"], { cwd: ROOT });
    assert.deepEqual(invocations, [{ cwd: "apps/web", args: ["--fix", "--", "my file.tsx"] }]);
  });
});

describe("buildPrettierCommand", () => {
  it("writes all staged paths with quoting", () => {
    const command = buildPrettierCommand(["apps/web/a.tsx", "docs/read me.md"], { cwd: ROOT });
    assert.equal(command, 'prettier --write "apps/web/a.tsx" "docs/read me.md"');
  });
});

describe("buildEslintCommand", () => {
  it("invokes the workspace runner during the task phase with a filename boundary", () => {
    const command = buildEslintCommand(["apps/web/src/page.tsx", "apps/web/my file.tsx"], {
      cwd: ROOT,
    });
    assert.equal(
      command,
      'node "scripts/lint-staged-eslint.mjs" -- "apps/web/src/page.tsx" "apps/web/my file.tsx"',
    );
  });
});

describe("parseLintStagedFilenames", () => {
  it("keeps paths after -- including spaces", () => {
    assert.deepEqual(parseLintStagedFilenames(["--fix", "--", "src/page.tsx", "my file.tsx"]), [
      "src/page.tsx",
      "my file.tsx",
    ]);
  });
});

function runGit(args, cwd, env = process.env) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...env, NO_COLOR: "1", FORCE_COLOR: "0" },
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

function gitCommit(cwd, message, env) {
  return runGit(
    [
      "-c",
      "user.name=Atlas Test",
      "-c",
      "user.email=atlas-test@example.com",
      "commit",
      "--no-gpg-sign",
      "-m",
      message,
    ],
    cwd,
    env,
  );
}

function createLintStagedRepo() {
  const fixture = mkdtempSync(path.join(os.tmpdir(), "atlas-lint-staged-"));
  const hookEnv = {
    ...process.env,
    PATH: `${path.join(fixture, "node_modules/.bin")}${path.delimiter}${process.env.PATH ?? ""}`,
  };
  delete hookEnv.HUSKY;
  delete hookEnv.HUSKY_SKIP_HOOKS;

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
          prettier: "3.4.2",
        },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    path.join(fixture, "apps/web/package.json"),
    `${JSON.stringify({ name: "@atlas/web", private: true }, null, 2)}\n`,
  );
  writeFileSync(
    path.join(fixture, "apps/web/eslint.config.mjs"),
    `export default [
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: { "no-console": "error" },
  },
];
`,
  );
  copyFileSync(path.join(REPO_ROOT, "lint-staged.config.mjs"), path.join(fixture, "lint-staged.config.mjs"));
  copyFileSync(
    path.join(REPO_ROOT, "scripts/lint-staged-utils.mjs"),
    path.join(fixture, "scripts/lint-staged-utils.mjs"),
  );
  copyFileSync(
    path.join(REPO_ROOT, "scripts/lint-staged-eslint.mjs"),
    path.join(fixture, "scripts/lint-staged-eslint.mjs"),
  );
  copyFileSync(
    path.join(REPO_ROOT, "packages/cli/bootstrap/capabilities/templates/pre-commit"),
    path.join(fixture, ".husky/pre-commit"),
  );
  chmodSync(path.join(fixture, ".husky/pre-commit"), 0o755);
  symlinkSync(path.join(REPO_ROOT, "node_modules/.bin"), path.join(fixture, "node_modules/.bin"));

  const init = runGit(["init"], fixture, hookEnv);
  assert.equal(init.status, 0, init.stderr);
  const hooksPath = runGit(["config", "core.hooksPath", ".husky"], fixture, hookEnv);
  assert.equal(hooksPath.status, 0, hooksPath.stderr);

  writeFileSync(path.join(fixture, "README.md"), "fixture\n");
  writeFileSync(path.join(fixture, "notes.txt"), "keep\n");
  const addInitial = runGit(["add", "README.md", "notes.txt"], fixture, hookEnv);
  assert.equal(addInitial.status, 0, addInitial.stderr);
  const initial = gitCommit(fixture, "chore: initial commit", hookEnv);
  assert.equal(initial.status, 0, `${initial.stdout}\n${initial.stderr}`);

  return { fixture, hookEnv };
}

describe("lint-staged commit task phase", () => {
  it("fails when staged code is invalid even if the working copy was corrected", () => {
    const { fixture, hookEnv } = createLintStagedRepo();
    try {
      const pagePath = path.join(fixture, "apps/web/src/page.tsx");
      writeFileSync(pagePath, "export const value = 1;\nconsole.log(value);\n");
      assert.equal(runGit(["add", "apps/web/src/page.tsx"], fixture, hookEnv).status, 0);
      writeFileSync(pagePath, "export const value = 1;\n");
      writeFileSync(path.join(fixture, "notes.txt"), "unstaged notes\n");

      const blocked = gitCommit(fixture, "test: invalid staged copy must fail", hookEnv);
      assert.notEqual(blocked.status, 0, `${blocked.stdout}\n${blocked.stderr}`);
      assert.match(`${blocked.stdout}\n${blocked.stderr}`, /no-console|eslint/i);

      const staged = runGit(["show", ":apps/web/src/page.tsx"], fixture, hookEnv);
      assert.match(staged.stdout, /console\.log/);
      assert.equal(readFileSync(pagePath, "utf8"), "export const value = 1;\n");
      assert.equal(readFileSync(path.join(fixture, "notes.txt"), "utf8"), "unstaged notes\n");
      const notesStaged = runGit(["show", ":notes.txt"], fixture, hookEnv);
      assert.equal(notesStaged.stdout, "keep\n");
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("passes valid staged code and leaves an invalid unstaged edit unstaged", () => {
    const { fixture, hookEnv } = createLintStagedRepo();
    try {
      const pagePath = path.join(fixture, "apps/web/src/my file.tsx");
      writeFileSync(pagePath, "export const value = 1;\n");
      assert.equal(runGit(["add", "apps/web/src/my file.tsx"], fixture, hookEnv).status, 0);
      writeFileSync(pagePath, "export const value = 1;\nconsole.log(value);\n");

      const passed = gitCommit(fixture, "test: valid staged copy must pass", hookEnv);
      assert.equal(passed.status, 0, `${passed.stdout}\n${passed.stderr}`);

      const committed = runGit(["show", "HEAD:apps/web/src/my file.tsx"], fixture, hookEnv);
      assert.equal(committed.stdout, "export const value = 1;\n");
      assert.equal(readFileSync(pagePath, "utf8"), "export const value = 1;\nconsole.log(value);\n");
      const status = runGit(["status", "--porcelain"], fixture, hookEnv);
      assert.match(status.stdout, /my file\.tsx/);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});
