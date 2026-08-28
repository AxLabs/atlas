import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  collectLockfileNonRegistryFindings,
  collectWorkspaceDependencySourceFindings,
  formatDependencySourceFinding,
  isAtlasWorkspaceLink,
  isNonRegistryDependencySpec,
} from "../dependency-sources.mjs";

function createTempRepo(files) {
  const root = mkdtempSync(path.join(os.tmpdir(), "atlas-dep-sources-"));

  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, contents, "utf8");
  }

  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

test("allows atlas workspace links and rejects common non-registry specs", () => {
  assert.equal(isAtlasWorkspaceLink("@atlas/ui", "workspace:*"), true);
  assert.equal(isNonRegistryDependencySpec("workspace:*"), true);
  assert.equal(isNonRegistryDependencySpec("github:owner/repo"), true);
  assert.equal(isNonRegistryDependencySpec("owner/repo"), true);
  assert.equal(isNonRegistryDependencySpec("owner/repo#abc123"), true);
  assert.equal(isNonRegistryDependencySpec("git+https://github.com/owner/repo.git"), true);
  assert.equal(isNonRegistryDependencySpec("git+ssh://git@github.com/owner/repo.git"), true);
  assert.equal(isNonRegistryDependencySpec("file:../foo"), true);
  assert.equal(isNonRegistryDependencySpec("link:../foo"), true);
  assert.equal(isNonRegistryDependencySpec("https://example.com/download"), true);
  assert.equal(isNonRegistryDependencySpec("https://example.com/pkg.tgz"), true);
  assert.equal(isNonRegistryDependencySpec("http://example.com/package"), true);
  assert.equal(isNonRegistryDependencySpec("^1.2.3"), false);
  assert.equal(isNonRegistryDependencySpec("1.2.3"), false);
  assert.equal(isNonRegistryDependencySpec("npm:foo@^1.0.0"), false);
});

test("detects direct https workspace dependency declarations", () => {
  const fixture = createTempRepo({
    "pnpm-workspace.yaml": `packages:\n  - "apps/*"\n`,
    "apps/web/package.json": JSON.stringify(
      {
        name: "@atlas/web",
        dependencies: {
          "bad-dep": "https://downloads.example.com/package?id=123",
        },
      },
      null,
      2,
    ),
  });

  try {
    const findings = collectWorkspaceDependencySourceFindings(fixture.root);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].dependency, "bad-dep");
    assert.match(formatDependencySourceFinding(findings[0]), /https:\/\/downloads\.example\.com/);
  } finally {
    fixture.cleanup();
  }
});

test("detects non-registry workspace dependency declarations", () => {
  const fixture = createTempRepo({
    "pnpm-workspace.yaml": `packages:\n  - "apps/*"\n`,
    "apps/web/package.json": JSON.stringify(
      {
        name: "@atlas/web",
        dependencies: {
          "bad-dep": "github:evil/pkg",
        },
      },
      null,
      2,
    ),
  });

  try {
    const findings = collectWorkspaceDependencySourceFindings(fixture.root);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].dependency, "bad-dep");
    assert.match(formatDependencySourceFinding(findings[0]), /github:evil\/pkg/);
  } finally {
    fixture.cleanup();
  }
});

test("detects suspicious lockfile resolutions without flagging require-directory", () => {
  const fixture = createTempRepo({
    "pnpm-lock.yaml": `lockfileVersion: '9.0'

importers:
  .:
    dependencies:
      foo:
        specifier: workspace:*
        version: link:packages/foo

packages:
  foo@1.0.0:
    resolution:
      tarball: https://example.com/foo.tgz
`,
  });

  try {
    const findings = collectLockfileNonRegistryFindings(fixture.root);
    assert.ok(findings.some((finding) => finding.text.includes("tarball:")));
    assert.ok(
      !findings.some((finding) => finding.text.includes("require-directory")),
      "package names containing directory should not match",
    );
  } finally {
    fixture.cleanup();
  }
});
