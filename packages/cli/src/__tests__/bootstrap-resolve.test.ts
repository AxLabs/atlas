import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { CLI_PACKAGE_NAME } from "../version";
import { sha256Bytes } from "../bootstrap/checksum";
import { BOOTSTRAP_MANIFEST_SCHEMA_VERSION } from "../bootstrap/constants";
import {
  findBootstrapAssetRoot,
  readBootstrapManifest,
  resolveBootstrapAsset,
} from "../bootstrap/resolve";
import { serializePackagedBootstrapManifest } from "../bootstrap/schema";

function writeInstalledCliLayout(): { root: string; cleanup: () => void } {
  const root = mkdtempSync(path.join(os.tmpdir(), "atlas-bootstrap-installed-"));
  writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: CLI_PACKAGE_NAME, version: "9.9.9" }, null, 2)}\n`,
    "utf8"
  );

  const filesRoot = path.join(root, "assets", "bootstrap", "files");
  const destination = "apps/web/package.json";
  const absolute = path.join(filesRoot, ...destination.split("/"));
  mkdirSync(path.dirname(absolute), { recursive: true });
  const content = `${JSON.stringify({ name: "@atlas/web", private: true }, null, 2)}\n`;
  writeFileSync(absolute, content, "utf8");

  writeFileSync(
    path.join(root, "assets", "bootstrap", "manifest.json"),
    serializePackagedBootstrapManifest({
      schemaVersion: BOOTSTRAP_MANIFEST_SCHEMA_VERSION,
      atlasVersion: "9.9.9",
      generatedAtInit: [],
      entries: [
        {
          source: "apps/web/package.json",
          destination,
          sha256: sha256Bytes(Buffer.from(content, "utf8")),
          mode: "0644",
        },
      ],
    }),
    "utf8"
  );

  mkdirSync(path.join(root, "dist", "nested"), { recursive: true });
  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

describe("installed-package bootstrap asset resolution", () => {
  it("locates packaged assets from the installed @blitzcraftlabs/atlas package, not cwd or a checkout", () => {
    const installed = writeInstalledCliLayout();
    const decoy = mkdtempSync(path.join(os.tmpdir(), "atlas-bootstrap-decoy-cwd-"));
    const previousCwd = process.cwd();

    try {
      writeFileSync(
        path.join(decoy, "package.json"),
        `${JSON.stringify({ name: "@atlas/monorepo", version: "0.0.0" }, null, 2)}\n`,
        "utf8"
      );
      mkdirSync(path.join(decoy, "assets", "bootstrap"), { recursive: true });
      writeFileSync(path.join(decoy, "assets", "bootstrap", "manifest.json"), "{}\n");
      process.chdir(decoy);

      const startDir = path.join(installed.root, "dist", "nested");
      const assetRoot = findBootstrapAssetRoot(startDir);
      expect(assetRoot).toBe(path.join(installed.root, "assets", "bootstrap"));
      expect(assetRoot.startsWith(decoy)).toBe(false);

      const manifest = readBootstrapManifest(assetRoot);
      expect(manifest.atlasVersion).toBe("9.9.9");
      expect(manifest.entries).toHaveLength(1);

      const resolved = resolveBootstrapAsset("apps/web/package.json", assetRoot);
      expect(readFileSync(resolved.absolutePath, "utf8")).toContain("@atlas/web");
      expect(resolved.absolutePath.startsWith(installed.root)).toBe(true);
    } finally {
      process.chdir(previousCwd);
      installed.cleanup();
      rmSync(decoy, { recursive: true, force: true });
    }
  });

  it("does not treat an Atlas checkout root as the CLI package", () => {
    const checkout = mkdtempSync(path.join(os.tmpdir(), "atlas-bootstrap-checkout-"));
    try {
      writeFileSync(
        path.join(checkout, "package.json"),
        `${JSON.stringify({ name: "@atlas/monorepo", version: "1.2.3" }, null, 2)}\n`,
        "utf8"
      );
      expect(() => findBootstrapAssetRoot(checkout)).toThrow(
        `Unable to locate ${CLI_PACKAGE_NAME} package.json`
      );
    } finally {
      rmSync(checkout, { recursive: true, force: true });
    }
  });
});
