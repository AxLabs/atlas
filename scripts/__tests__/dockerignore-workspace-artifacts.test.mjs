import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const NESTED_WORKSPACE_ARTIFACTS = [
  "packages/config/node_modules/@typescript-eslint/eslint-plugin",
  "apps/web/node_modules/@atlas/ui",
  "apps/web/.next/server.js",
  "packages/cli/.turbo/turbo-build.log",
  "packages/cli/dist/index.js",
  "packages/cli/coverage/lcov.info",
  "apps/web/src/test/helpers/router.ts",
  "apps/web/e2e/smoke.spec.ts",
];

const SOURCE_COPY_PATHS = [
  "package.json",
  "pnpm-workspace.yaml",
  "pnpm-lock.yaml",
  "turbo.json",
  "scripts/ensure-pnpm.js",
  "apps/web/package.json",
  "apps/web/next.config.js",
  "apps/web/tsconfig.json",
  "apps/web/src/app/page.tsx",
  "packages/ui/package.json",
  "packages/ui/src/index.ts",
  "packages/consent/package.json",
  "packages/consent/src/index.ts",
  "packages/config/package.json",
  "packages/config/tsconfig.base.json",
  "packages/config/eslint.config.mjs",
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseDockerignorePatterns(contents) {
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function globToRegExp(pattern) {
  const normalized = pattern.replace(/\/+$/, "");
  let index = 0;
  let source = "^";

  while (index < normalized.length) {
    if (normalized.startsWith("**/", index)) {
      source += "(?:.*/)?";
      index += 3;
      continue;
    }
    if (normalized.slice(index) === "**") {
      source += ".*";
      index += 2;
      continue;
    }

    const character = normalized[index];
    if (character === "*") {
      source += "[^/]*";
    } else if (character === "?") {
      source += "[^/]";
    } else {
      source += escapeRegExp(character);
    }
    index += 1;
  }

  return new RegExp(`${source}$`);
}

function pathOrAncestorMatches(pattern, relativePath) {
  const matcher = globToRegExp(pattern);
  const segments = relativePath.split("/").filter(Boolean);

  for (let length = 1; length <= segments.length; length += 1) {
    if (matcher.test(segments.slice(0, length).join("/"))) {
      return true;
    }
  }

  return matcher.test(relativePath);
}

function dockerignoreExcludes(contents, relativePath) {
  const posixPath = relativePath.replaceAll("\\", "/").replace(/^\.\//, "");
  let excluded = false;

  for (const rawPattern of parseDockerignorePatterns(contents)) {
    const negated = rawPattern.startsWith("!");
    const pattern = negated ? rawPattern.slice(1) : rawPattern;
    if (pathOrAncestorMatches(pattern, posixPath)) {
      excluded = !negated;
    }
  }

  return excluded;
}

describe("Docker build context excludes nested workspace artifacts", () => {
  it("does not treat an unanchored node_modules pattern as recursive", () => {
    const naive = "node_modules\n";

    assert.equal(dockerignoreExcludes(naive, "node_modules/.pnpm/foo"), true);
    assert.equal(
      dockerignoreExcludes(
        naive,
        "packages/config/node_modules/@typescript-eslint/eslint-plugin"
      ),
      false
    );
  });

  it("excludes nested workspace dependency and build directories from COPY . .", () => {
    const dockerignore = readFileSync(path.join(repoRoot, ".dockerignore"), "utf8");
    const patterns = parseDockerignorePatterns(dockerignore);

    for (const required of ["**/node_modules", "**/.next", "**/.turbo", "**/dist", "**/coverage"]) {
      assert.equal(
        patterns.includes(required),
        true,
        `.dockerignore must contain ${required}`
      );
    }

    for (const relativePath of NESTED_WORKSPACE_ARTIFACTS) {
      assert.equal(
        dockerignoreExcludes(dockerignore, relativePath),
        true,
        `${relativePath} must not enter the Docker source-copy context`
      );
    }
  });

  it("keeps source files required for the image build in the context", () => {
    const dockerignore = readFileSync(path.join(repoRoot, ".dockerignore"), "utf8");

    for (const relativePath of SOURCE_COPY_PATHS) {
      assert.equal(
        dockerignoreExcludes(dockerignore, relativePath),
        false,
        `${relativePath} must remain available to COPY . .`
      );
    }
  });
});
