import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  collectUndeclaredDependenciesFromSourceFiles,
  discoverWorkspaceRoots,
  findUndeclaredDependenciesForAllWorkspaces,
  findUndeclaredDependenciesForWorkspace,
} from "../doctor/dependency-imports";

interface FixtureWorkspace {
  relativeRoot: string;
  packageJson: Record<string, unknown>;
  files?: Record<string, string>;
}

function createDependencyFixture(workspaces: FixtureWorkspace[]): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "atlas-deps-"));
  writeFileSync(
    path.join(root, "pnpm-workspace.yaml"),
    'packages:\n  - "apps/*"\n  - "packages/*"\n',
    "utf8"
  );

  for (const workspace of workspaces) {
    const workspaceRoot = path.join(root, workspace.relativeRoot);
    mkdirSync(workspaceRoot, { recursive: true });
    writeFileSync(
      path.join(workspaceRoot, "package.json"),
      `${JSON.stringify(workspace.packageJson, null, 2)}\n`,
      "utf8"
    );

    for (const [relativeFile, contents] of Object.entries(workspace.files ?? {})) {
      const filePath = path.join(workspaceRoot, relativeFile);
      mkdirSync(path.dirname(filePath), { recursive: true });
      writeFileSync(filePath, contents, "utf8");
    }
  }

  return root;
}

describe("discoverWorkspaceRoots", () => {
  it("discovers workspace roots from pnpm-workspace.yaml globs", () => {
    const root = createDependencyFixture([
      {
        relativeRoot: "apps/web",
        packageJson: { name: "@atlas/web", version: "0.1.0", private: true },
      },
      {
        relativeRoot: "packages/ui",
        packageJson: { name: "@atlas/ui", version: "0.1.0", private: true },
      },
      {
        relativeRoot: "packages/project",
        packageJson: { name: "@atlas/project", version: "0.1.0", private: true },
      },
    ]);

    const roots = discoverWorkspaceRoots(root);
    expect(roots).toEqual(["apps/web", "packages/project", "packages/ui"]);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("findUndeclaredDependenciesForWorkspace", () => {
  it("reports undeclared imports in apps/reference", () => {
    const root = createDependencyFixture([
      {
        relativeRoot: "apps/reference",
        packageJson: { name: "@atlas/reference", version: "0.1.0", private: true },
        files: {
          "src/example.ts": "import 'some-package';\n",
        },
      },
    ]);

    const findings = findUndeclaredDependenciesForWorkspace(root, "apps/reference", {
      scanMode: "repository",
    });

    expect(findings).toEqual([
      expect.objectContaining({
        workspaceRoot: "apps/reference",
        packageName: "some-package",
        filePath: "apps/reference/src/example.ts",
      }),
    ]);
    rmSync(root, { recursive: true, force: true });
  });

  it("reports undeclared imports in packages/ui", () => {
    const root = createDependencyFixture([
      {
        relativeRoot: "packages/ui",
        packageJson: { name: "@atlas/ui", version: "0.1.0", private: true },
        files: {
          "src/example.ts": "import 'some-package';\n",
        },
      },
    ]);

    const findings = findUndeclaredDependenciesForWorkspace(root, "packages/ui", {
      scanMode: "repository",
    });

    expect(findings).toEqual([
      expect.objectContaining({
        workspaceRoot: "packages/ui",
        packageName: "some-package",
      }),
    ]);
    rmSync(root, { recursive: true, force: true });
  });

  it("reports undeclared imports in packages/project", () => {
    const root = createDependencyFixture([
      {
        relativeRoot: "packages/project",
        packageJson: { name: "@atlas/project", version: "0.1.0", private: true },
        files: {
          "src/example.ts": "import 'some-package';\n",
        },
      },
    ]);

    const findings = findUndeclaredDependenciesForWorkspace(root, "packages/project", {
      scanMode: "repository",
    });

    expect(findings).toEqual([
      expect.objectContaining({
        workspaceRoot: "packages/project",
        packageName: "some-package",
      }),
    ]);
    rmSync(root, { recursive: true, force: true });
  });

  it("passes when the dependency is declared", () => {
    const root = createDependencyFixture([
      {
        relativeRoot: "apps/web",
        packageJson: {
          name: "@atlas/web",
          version: "0.1.0",
          private: true,
          dependencies: { "some-package": "1.0.0" },
        },
        files: {
          "src/example.ts": "import 'some-package';\n",
        },
      },
    ]);

    const findings = findUndeclaredDependenciesForWorkspace(root, "apps/web", {
      scanMode: "repository",
    });
    expect(findings).toHaveLength(0);
    rmSync(root, { recursive: true, force: true });
  });

  it("passes when a test-only import is declared in devDependencies", () => {
    const root = createDependencyFixture([
      {
        relativeRoot: "apps/web",
        packageJson: {
          name: "@atlas/web",
          version: "0.1.0",
          private: true,
          devDependencies: { "some-package": "1.0.0" },
        },
        files: {
          "src/example.test.ts": "import 'some-package';\n",
        },
      },
    ]);

    const findings = findUndeclaredDependenciesForWorkspace(root, "apps/web", {
      scanMode: "repository",
    });
    expect(findings).toHaveLength(0);
    rmSync(root, { recursive: true, force: true });
  });

  it("resolves subpath imports to package roots", () => {
    const root = createDependencyFixture([
      {
        relativeRoot: "packages/ui",
        packageJson: {
          name: "@atlas/ui",
          version: "0.1.0",
          private: true,
          dependencies: { "@base-ui/react": "1.0.0" },
        },
        files: {
          "src/dialog.ts": "import { Dialog } from '@base-ui/react/dialog';\n",
        },
      },
    ]);

    const findings = findUndeclaredDependenciesForWorkspace(root, "packages/ui", {
      scanMode: "repository",
    });
    expect(findings).toHaveLength(0);
    rmSync(root, { recursive: true, force: true });
  });

  it("reports subpath imports when the package root is undeclared", () => {
    const root = createDependencyFixture([
      {
        relativeRoot: "packages/ui",
        packageJson: { name: "@atlas/ui", version: "0.1.0", private: true },
        files: {
          "src/dialog.ts": "import { Dialog } from '@base-ui/react/dialog';\n",
        },
      },
    ]);

    const findings = findUndeclaredDependenciesForWorkspace(root, "packages/ui", {
      scanMode: "repository",
    });

    expect(findings).toEqual([
      expect.objectContaining({
        packageName: "@base-ui/react",
      }),
    ]);
    rmSync(root, { recursive: true, force: true });
  });

  it("scans config files in repository mode", () => {
    const root = createDependencyFixture([
      {
        relativeRoot: "apps/web",
        packageJson: { name: "@atlas/web", version: "0.1.0", private: true },
        files: {
          "eslint.config.mjs": "import eslint from 'some-package';\n",
        },
      },
    ]);

    const findings = findUndeclaredDependenciesForWorkspace(root, "apps/web", {
      scanMode: "repository",
    });

    expect(findings).toEqual([
      expect.objectContaining({
        packageName: "some-package",
        filePath: "apps/web/eslint.config.mjs",
      }),
    ]);
    rmSync(root, { recursive: true, force: true });
  });

  it("skips config files in application scan mode", () => {
    const root = createDependencyFixture([
      {
        relativeRoot: "apps/web",
        packageJson: { name: "@atlas/web", version: "0.1.0", private: true },
        files: {
          "eslint.config.mjs": "import eslint from 'some-package';\n",
        },
      },
    ]);

    const findings = findUndeclaredDependenciesForWorkspace(root, "apps/web", {
      scanMode: "application",
    });
    expect(findings).toHaveLength(0);
    rmSync(root, { recursive: true, force: true });
  });

  it("skips workspace-root packaged asset trees", () => {
    const root = createDependencyFixture([
      {
        relativeRoot: "packages/cli",
        packageJson: { name: "@atlas/cli", version: "0.1.0", private: true, dependencies: {} },
        files: {
          "src/cli.ts": "export {};\n",
          "assets/bootstrap/files/apps/web/src/example.ts": "import 'next';\n",
        },
      },
    ]);

    const findings = findUndeclaredDependenciesForWorkspace(root, "packages/cli", {
      scanMode: "repository",
    });
    expect(findings).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });

  it("skips files that disappear between enumeration and read", () => {
    const root = createDependencyFixture([
      {
        relativeRoot: "apps/web",
        packageJson: { name: "@atlas/web", version: "0.1.0", private: true },
        files: {
          "src/stable.ts": "import 'undeclared-stable';\n",
          "src/ephemeral.ts": "import 'undeclared-ephemeral';\n",
        },
      },
    ]);

    const stableFile = path.join(root, "apps/web/src/stable.ts");
    const ephemeralFile = path.join(root, "apps/web/src/ephemeral.ts");
    const enumeratedFiles = [ephemeralFile, stableFile];
    rmSync(ephemeralFile);

    let findings;
    expect(() => {
      findings = collectUndeclaredDependenciesFromSourceFiles(root, "apps/web", enumeratedFiles);
    }).not.toThrow();

    expect(findings).toEqual([
      expect.objectContaining({
        workspaceRoot: "apps/web",
        packageName: "undeclared-stable",
        filePath: "apps/web/src/stable.ts",
      }),
    ]);
    rmSync(root, { recursive: true, force: true });
  });

  it("does not swallow non-ENOENT filesystem errors while reading source files", () => {
    const root = createDependencyFixture([
      {
        relativeRoot: "apps/web",
        packageJson: { name: "@atlas/web", version: "0.1.0", private: true },
        files: {
          "src/stable.ts": "import 'undeclared-stable';\n",
        },
      },
    ]);

    expect(() =>
      collectUndeclaredDependenciesFromSourceFiles(root, "apps/web", [
        path.join(root, "apps/web/src"),
      ])
    ).toThrow(/EISDIR|EACCES|EPERM/);

    rmSync(root, { recursive: true, force: true });
  });

  it("skips test files in application scan mode", () => {
    const root = createDependencyFixture([
      {
        relativeRoot: "apps/web",
        packageJson: { name: "@atlas/web", version: "0.1.0", private: true },
        files: {
          "src/example.test.ts": "import 'some-package';\n",
        },
      },
    ]);

    const findings = findUndeclaredDependenciesForWorkspace(root, "apps/web", {
      scanMode: "application",
    });
    expect(findings).toHaveLength(0);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("findUndeclaredDependenciesForAllWorkspaces", () => {
  it("audits every discovered workspace", () => {
    const root = createDependencyFixture([
      {
        relativeRoot: "apps/web",
        packageJson: { name: "@atlas/web", version: "0.1.0", private: true },
        files: {
          "src/example.ts": "import 'undeclared-web';\n",
        },
      },
      {
        relativeRoot: "packages/ui",
        packageJson: { name: "@atlas/ui", version: "0.1.0", private: true },
        files: {
          "src/example.ts": "import 'undeclared-ui';\n",
        },
      },
    ]);

    const findings = findUndeclaredDependenciesForAllWorkspaces(root, {
      scanMode: "repository",
    });

    expect(findings.map((finding) => finding.packageName).sort()).toEqual([
      "undeclared-ui",
      "undeclared-web",
    ]);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("repository dependency validation on Atlas checkout", () => {
  const repoRoot = path.resolve(__dirname, "../../../..");

  it("passes on current Atlas manifests", () => {
    if (!existsSync(path.join(repoRoot, "pnpm-workspace.yaml"))) {
      return;
    }

    const findings = findUndeclaredDependenciesForAllWorkspaces(repoRoot, {
      scanMode: "repository",
    });
    expect(findings).toEqual([]);
  });
});
