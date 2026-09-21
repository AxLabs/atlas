import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";

import {
  buildEslintInvocations,
  buildPrettierCommand,
  ESLINT_PACKAGES,
  groupByEslintRoot,
  quote,
  toRepoRelativePosix,
} from "../lint-staged-utils.mjs";

const ROOT = "/repo";

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
