import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";

import {
  buildEslintCommands,
  buildPrettierCommand,
  ESLINT_PACKAGES,
  groupByEslintRoot,
  quote,
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

describe("groupByEslintRoot", () => {
  it("groups files by workspace eslint root", () => {
    const { groups, rootFiles } = groupByEslintRoot([
      "apps/web/src/page.tsx",
      "packages/ui/src/button.tsx",
      "packages/consent/src/index.ts",
      "packages/config/eslint.config.mjs",
      "scripts/foo.mjs",
    ]);

    assert.deepEqual(rootFiles, ["scripts/foo.mjs"]);
    assert.equal(groups.get("apps/web")?.length, 1);
    assert.equal(groups.get("packages/ui")?.length, 1);
    assert.equal(groups.get("packages/consent")?.length, 1);
    assert.equal(groups.get("packages/config")?.length, 1);
  });

  it("normalizes Windows path separators", () => {
    const { groups } = groupByEslintRoot(["apps\\web\\src\\page.tsx"]);
    assert.equal(groups.get("apps/web")?.[0], "apps\\web\\src\\page.tsx");
  });

  it("covers every configured eslint package", () => {
    for (const packageDir of ESLINT_PACKAGES) {
      const { groups } = groupByEslintRoot([`${packageDir}/file.ts`]);
      assert.equal(groups.get(packageDir)?.[0], `${packageDir}/file.ts`);
    }
  });
});

describe("buildEslintCommands", () => {
  it("runs eslint from each workspace directory with relative paths", () => {
    const commands = buildEslintCommands(
      ["apps/web/src/page.tsx", "packages/ui/src/input.tsx"],
      { cwd: ROOT, eslintBin: path.join(ROOT, "node_modules/.bin/eslint") },
    );

    assert.equal(commands.length, 2);
    assert.match(commands[0], /^cd "apps\/web" &&/);
    assert.match(commands[0], /eslint.*"src\/page\.tsx"/);
    assert.match(commands[1], /^cd "packages\/ui" &&/);
    assert.match(commands[1], /eslint.*"src\/input\.tsx"/);
  });

  it("lints root-level files with the root eslint config", () => {
    const commands = buildEslintCommands(["scripts/foo.mjs"], {
      cwd: ROOT,
      eslintBin: path.join(ROOT, "node_modules/.bin/eslint"),
    });

    assert.equal(commands.length, 1);
    assert.match(commands[0], /^".*eslint".*--fix "scripts\/foo\.mjs"$/);
    assert.doesNotMatch(commands[0], /^cd /);
  });

  it("handles filenames with spaces", () => {
    const commands = buildEslintCommands(["apps/web/my file.tsx"], {
      cwd: ROOT,
      eslintBin: path.join(ROOT, "node_modules/.bin/eslint"),
    });

    assert.match(commands[0], /"my file\.tsx"/);
  });
});

describe("buildPrettierCommand", () => {
  it("writes all staged paths with quoting", () => {
    const command = buildPrettierCommand(["apps/web/a.tsx", "docs/read me.md"]);
    assert.equal(command, 'prettier --write "apps/web/a.tsx" "docs/read me.md"');
  });
});
