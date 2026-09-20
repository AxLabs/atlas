import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { PUBLIC_CLI_PACKAGE_NAME } from "../atlas-workspaces.mjs";
import {
  assertRegistryInstallSpecifier,
  collectRegistryFallbackIssues,
  parseRegistryVersionArgument,
  registryInstallSpecifier,
} from "../lib/distribution-registry.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("registry verification arguments", () => {
  it("accepts an exact Atlas version and builds a registry specifier", () => {
    assert.equal(parseRegistryVersionArgument("1.0.0"), "1.0.0");
    assert.equal(registryInstallSpecifier("1.0.0"), `${PUBLIC_CLI_PACKAGE_NAME}@1.0.0`);
    assert.doesNotThrow(() => assertRegistryInstallSpecifier(`${PUBLIC_CLI_PACKAGE_NAME}@1.0.0`));
  });

  it("rejects tarball, path, and workspace fallbacks", () => {
    assert.throws(() => parseRegistryVersionArgument("blitzcraftlabs-atlas-0.5.0.tgz"), /tarball/);
    assert.throws(() => parseRegistryVersionArgument("../0.5.0"), /path-like/);
    assert.throws(() => parseRegistryVersionArgument("file:./package.tgz"), /tarball/);
    assert.throws(
      () => assertRegistryInstallSpecifier("/tmp/blitzcraftlabs-atlas-0.5.0.tgz"),
      /local tarball/
    );
    assert.throws(() => parseRegistryVersionArgument("0.5.0;true"), /unsafe registry version/);
  });

  it("fails closed when offline flags would hide a missing registry package", () => {
    assert.deepEqual(collectRegistryFallbackIssues({}), []);
    assert.ok(
      collectRegistryFallbackIssues({ npm_config_offline: "true" }).some((issue) =>
        issue.includes("offline")
      )
    );
  });

  it("does not silently pack or install a workspace tarball", () => {
    const verifier = readFileSync(
      path.join(repoRoot, "scripts", "verify-distribution-registry.mjs"),
      "utf8"
    );
    assert.match(verifier, /queryNpmPackageVersion/);
    assert.match(verifier, /does not fall back to a local tarball/);
    assert.match(verifier, /resolveGeneratedProjectPnpm/);
    assert.doesNotMatch(verifier, /packExactPublicCliTarball/);
    assert.doesNotMatch(verifier, /pnpm pack/);
    assert.doesNotMatch(verifier, /findPackedTarball/);
    assert.match(verifier, /--registry/);
  });
});
