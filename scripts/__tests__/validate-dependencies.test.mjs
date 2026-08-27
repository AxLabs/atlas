import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);

function loadDependencyValidation() {
  try {
    return require("@atlas/cli/dependency-validation");
  } catch {
    execSync("pnpm turbo build --filter=@atlas/cli", {
      cwd: repoRoot,
      stdio: "pipe",
    });
    return require("@atlas/cli/dependency-validation");
  }
}

test("@atlas/cli/dependency-validation subpath resolves after build", () => {
  execSync("pnpm turbo build --filter=@atlas/cli", {
    cwd: repoRoot,
    stdio: "pipe",
  });

  const module = loadDependencyValidation();
  assert.equal(typeof module.discoverWorkspaceRoots, "function");
  assert.equal(typeof module.findUndeclaredDependenciesForWorkspace, "function");
  assert.equal(typeof module.findUndeclaredDependenciesForAllWorkspaces, "function");
});

test("@atlas/cli/workspace-membership is not exported", () => {
  assert.throws(
    () => require("@atlas/cli/workspace-membership"),
    (error) => error.code === "MODULE_NOT_FOUND" || error.code === "ERR_PACKAGE_PATH_NOT_EXPORTED",
  );
});

function createTempFixture(workspaces) {
  const root = mkdtempSync(path.join(os.tmpdir(), "atlas-deps-script-"));
  writeFileSync(
    path.join(root, "pnpm-workspace.yaml"),
    "packages:\n  - \"apps/*\"\n  - \"packages/*\"\n",
    "utf8",
  );

  for (const workspace of workspaces) {
    const workspaceRoot = path.join(root, workspace.relativeRoot);
    mkdirSync(workspaceRoot, { recursive: true });
    writeFileSync(
      path.join(workspaceRoot, "package.json"),
      `${JSON.stringify(workspace.packageJson, null, 2)}\n`,
      "utf8",
    );

    for (const [relativeFile, contents] of Object.entries(workspace.files ?? {})) {
      const filePath = path.join(workspaceRoot, relativeFile);
      mkdirSync(path.dirname(filePath), { recursive: true });
      writeFileSync(filePath, contents, "utf8");
    }
  }

  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

test("validate-dependencies passes on current manifests", () => {
  execSync("pnpm dependencies:check", {
    cwd: repoRoot,
    stdio: "pipe",
  });
});

test("discoverWorkspaceRoots finds Atlas workspaces from pnpm-workspace.yaml", () => {
  const { discoverWorkspaceRoots } = loadDependencyValidation();
  const roots = discoverWorkspaceRoots(repoRoot);

  assert.ok(roots.includes("apps/web"));
  assert.ok(roots.includes("apps/reference"));
  assert.ok(roots.includes("packages/ui"));
  assert.ok(roots.includes("packages/project"));
  assert.ok(roots.includes("packages/cli"));
});

test("undeclared reference import fails generic ownership validation", () => {
  const fixture = createTempFixture([
    {
      relativeRoot: "apps/reference",
      packageJson: { name: "@atlas/reference", version: "0.1.0", private: true },
      files: { "src/example.ts": "import 'some-package';\n" },
    },
  ]);

  const { findUndeclaredDependenciesForWorkspace } = loadDependencyValidation();
  const findings = findUndeclaredDependenciesForWorkspace(fixture.root, "apps/reference", {
    scanMode: "repository",
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].workspaceRoot, "apps/reference");
  assert.equal(findings[0].packageName, "some-package");

  fixture.cleanup();
});

test("undeclared ui import fails generic ownership validation", () => {
  const fixture = createTempFixture([
    {
      relativeRoot: "packages/ui",
      packageJson: { name: "@atlas/ui", version: "0.1.0", private: true },
      files: { "src/example.ts": "import 'some-package';\n" },
    },
  ]);

  const { findUndeclaredDependenciesForWorkspace } = loadDependencyValidation();
  const findings = findUndeclaredDependenciesForWorkspace(fixture.root, "packages/ui", {
    scanMode: "repository",
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].packageName, "some-package");

  fixture.cleanup();
});

test("undeclared project import fails generic ownership validation", () => {
  const fixture = createTempFixture([
    {
      relativeRoot: "packages/project",
      packageJson: { name: "@atlas/project", version: "0.1.0", private: true },
      files: { "src/example.ts": "import 'some-package';\n" },
    },
  ]);

  const { findUndeclaredDependenciesForWorkspace } = loadDependencyValidation();
  const findings = findUndeclaredDependenciesForWorkspace(fixture.root, "packages/project", {
    scanMode: "repository",
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].packageName, "some-package");

  fixture.cleanup();
});

test("declared dependency passes generic ownership validation", () => {
  const fixture = createTempFixture([
    {
      relativeRoot: "packages/ui",
      packageJson: {
        name: "@atlas/ui",
        version: "0.1.0",
        private: true,
        dependencies: { "some-package": "1.0.0" },
      },
      files: { "src/example.ts": "import 'some-package';\n" },
    },
  ]);

  const { findUndeclaredDependenciesForWorkspace } = loadDependencyValidation();
  const findings = findUndeclaredDependenciesForWorkspace(fixture.root, "packages/ui", {
    scanMode: "repository",
  });

  assert.equal(findings.length, 0);
  fixture.cleanup();
});

test("devDependency for test import passes generic ownership validation", () => {
  const fixture = createTempFixture([
    {
      relativeRoot: "packages/ui",
      packageJson: {
        name: "@atlas/ui",
        version: "0.1.0",
        private: true,
        devDependencies: { "some-package": "1.0.0" },
      },
      files: { "src/example.test.ts": "import 'some-package';\n" },
    },
  ]);

  const { findUndeclaredDependenciesForWorkspace } = loadDependencyValidation();
  const findings = findUndeclaredDependenciesForWorkspace(fixture.root, "packages/ui", {
    scanMode: "repository",
  });

  assert.equal(findings.length, 0);
  fixture.cleanup();
});

test("subpath import resolves to package root ownership", () => {
  const fixture = createTempFixture([
    {
      relativeRoot: "packages/ui",
      packageJson: {
        name: "@atlas/ui",
        version: "0.1.0",
        private: true,
        dependencies: { "@base-ui/react": "1.0.0" },
      },
      files: { "src/dialog.ts": "import { Dialog } from '@base-ui/react/dialog';\n" },
    },
  ]);

  const { findUndeclaredDependenciesForWorkspace } = loadDependencyValidation();
  const findings = findUndeclaredDependenciesForWorkspace(fixture.root, "packages/ui", {
    scanMode: "repository",
  });

  assert.equal(findings.length, 0);
  fixture.cleanup();
});
