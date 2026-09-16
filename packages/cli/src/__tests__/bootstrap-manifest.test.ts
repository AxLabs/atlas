import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { BootstrapAssetError } from "../bootstrap/errors";
import { parseSourceBootstrapManifest } from "../bootstrap/schema";
import { buildBootstrapAssets } from "../bootstrap/build";
import { CLI_PACKAGE_NAME } from "../version";

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function createSandbox(): { root: string; cleanup: () => void } {
  const root = mkdtempSync(path.join(os.tmpdir(), "atlas-bootstrap-manifest-"));
  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

describe("bootstrap source manifest validation", () => {
  it("rejects absolute source and destination paths", () => {
    expect(() =>
      parseSourceBootstrapManifest({
        schemaVersion: 1,
        entries: [{ source: "/tmp/file.txt", destination: "file.txt" }],
      })
    ).toThrow(BootstrapAssetError);

    expect(() =>
      parseSourceBootstrapManifest({
        schemaVersion: 1,
        entries: [{ source: "file.txt", destination: "C:\\Windows\\file.txt" }],
      })
    ).toThrow(/absolute path/);
  });

  it("rejects parent-segment traversal", () => {
    expect(() =>
      parseSourceBootstrapManifest({
        schemaVersion: 1,
        entries: [{ source: "../secret.txt", destination: "secret.txt" }],
      })
    ).toThrow(/\.\./);

    expect(() =>
      parseSourceBootstrapManifest({
        schemaVersion: 1,
        entries: [{ source: "file.txt", destination: "nested/../../outside.txt" }],
      })
    ).toThrow(/\.\./);
  });

  it("rejects duplicate destinations", () => {
    expect(() =>
      parseSourceBootstrapManifest({
        schemaVersion: 1,
        entries: [
          { source: "a.txt", destination: "shared.txt" },
          { source: "b.txt", destination: "shared.txt" },
        ],
      })
    ).toThrow(/Duplicate destination/);
  });

  it("rejects unknown fields", () => {
    expect(() =>
      parseSourceBootstrapManifest({
        schemaVersion: 1,
        plugin: true,
        entries: [{ source: "a.txt", destination: "a.txt" }],
      })
    ).toThrow(BootstrapAssetError);
  });

  it("fails closed when a source file is missing", () => {
    const sandbox = createSandbox();
    try {
      writeJson(path.join(sandbox.root, "package.json"), {
        name: CLI_PACKAGE_NAME,
        version: "0.0.0-test",
      });
      writeJson(path.join(sandbox.root, "bootstrap/manifest.json"), {
        schemaVersion: 1,
        entries: [{ source: "missing.txt", destination: "missing.txt" }],
      });
      writeFileSync(path.join(sandbox.root, "present.txt"), "ok\n");

      expect(() =>
        buildBootstrapAssets({
          repoRoot: sandbox.root,
          packageRoot: sandbox.root,
        })
      ).toThrow(/missing/);
    } finally {
      sandbox.cleanup();
    }
  });

  it("rejects a symlink that escapes the repository", () => {
    const sandbox = createSandbox();
    const outside = mkdtempSync(path.join(os.tmpdir(), "atlas-bootstrap-outside-"));
    try {
      writeJson(path.join(sandbox.root, "package.json"), {
        name: CLI_PACKAGE_NAME,
        version: "0.0.0-test",
      });
      writeFileSync(path.join(outside, "secret.txt"), "secret\n");
      symlinkSync(path.join(outside, "secret.txt"), path.join(sandbox.root, "link.txt"));
      writeJson(path.join(sandbox.root, "bootstrap/manifest.json"), {
        schemaVersion: 1,
        entries: [{ source: "link.txt", destination: "link.txt" }],
      });

      expect(() =>
        buildBootstrapAssets({
          repoRoot: sandbox.root,
          packageRoot: sandbox.root,
        })
      ).toThrow(/outside/);
    } finally {
      sandbox.cleanup();
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("rejects destination prefix conflicts after expansion", () => {
    const sandbox = createSandbox();
    try {
      writeJson(path.join(sandbox.root, "package.json"), {
        name: CLI_PACKAGE_NAME,
        version: "0.0.0-test",
      });
      writeFileSync(path.join(sandbox.root, "nested.txt"), "nested\n");
      mkdirSync(path.join(sandbox.root, "apps"), { recursive: true });
      writeFileSync(path.join(sandbox.root, "apps", "file.txt"), "app\n");
      writeJson(path.join(sandbox.root, "bootstrap/manifest.json"), {
        schemaVersion: 1,
        entries: [
          { source: "nested.txt", destination: "apps" },
          { source: "apps/file.txt", destination: "apps/file.txt" },
        ],
      });

      expect(() =>
        buildBootstrapAssets({
          repoRoot: sandbox.root,
          packageRoot: sandbox.root,
        })
      ).toThrow(/conflicts with nested destination/);
    } finally {
      sandbox.cleanup();
    }
  });
});
