import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { PUBLIC_CLI_PACKAGE_NAME } from "../atlas-workspaces.mjs";
import {
  NPM_OIDC_PUBLISH_ARGS,
  NPM_PUBLICATION_ACTIONS,
  NPM_PUBLISH_ARGS,
  NPM_TRUSTED_PUBLISHING_MIN_NODE,
  NPM_TRUSTED_PUBLISHING_MIN_NPM,
  appendGithubOutput,
  assertSafeNpmIdentity,
  buildManualPublishCommand,
  canonicalTarballFileName,
  collectCanonicalReleaseCheckoutIssues,
  collectPublicationIdentityIssues,
  collectTrustedPublishingToolchainIssues,
  compareDotVersions,
  decideNpmPublicationAction,
  expectedGitTag,
  hashFileSha256,
  npmRegistryDocumentUrl,
  publishExactTarball,
  queryNpmPackageVersion,
  runNpmPublication,
  stripNpmAuthEnv,
} from "../lib/npm-publication.mjs";

describe("npm publication identity", () => {
  it("accepts the public CLI identity and canonical tag", () => {
    assert.equal(expectedGitTag("0.5.0"), "v0.5.0");
    assert.equal(
      canonicalTarballFileName(PUBLIC_CLI_PACKAGE_NAME, "0.5.0"),
      "blitzcraftlabs-atlas-0.5.0.tgz"
    );
    assert.equal(expectedGitTag("1.0.0"), "v1.0.0");
    assert.equal(
      canonicalTarballFileName(PUBLIC_CLI_PACKAGE_NAME, "1.0.0"),
      "blitzcraftlabs-atlas-1.0.0.tgz"
    );
    assert.equal(expectedGitTag("1.0.1"), "v1.0.1");
    assert.equal(
      canonicalTarballFileName(PUBLIC_CLI_PACKAGE_NAME, "1.0.1"),
      "blitzcraftlabs-atlas-1.0.1.tgz"
    );
    assert.doesNotThrow(() =>
      assertSafeNpmIdentity({
        packageName: PUBLIC_CLI_PACKAGE_NAME,
        version: "1.0.1",
        tag: "v1.0.1",
      })
    );
    assert.doesNotThrow(() =>
      assertSafeNpmIdentity({
        packageName: PUBLIC_CLI_PACKAGE_NAME,
        version: "1.0.0",
        tag: "v1.0.0",
      })
    );
  });

  it("rejects shell-injection shaped versions, tags, and package names", () => {
    assert.throws(
      () =>
        assertSafeNpmIdentity({ packageName: PUBLIC_CLI_PACKAGE_NAME, version: "0.5.0; rm -rf /" }),
      /unsafe npm version/
    );
    assert.throws(
      () =>
        assertSafeNpmIdentity({
          packageName: PUBLIC_CLI_PACKAGE_NAME,
          version: "0.5.0",
          tag: "v0.5.0$(whoami)",
        }),
      /unsafe git tag/
    );
    assert.throws(
      () => assertSafeNpmIdentity({ packageName: "@atlas/ui", version: "0.5.0" }),
      /only @blitzcraftlabs\/atlas/
    );
    assert.throws(
      () => canonicalTarballFileName(PUBLIC_CLI_PACKAGE_NAME, "../evil/0.5.0"),
      /unsafe npm version/
    );
  });

  it("requires CLI, root, tag, catalog, packed, and requested versions to agree", () => {
    const aligned = {
      packageName: PUBLIC_CLI_PACKAGE_NAME,
      version: "0.5.0",
      rootVersion: "0.5.0",
      cliVersion: "0.5.0",
      tag: "v0.5.0",
      catalogCurrent: "0.5.0",
      packedName: PUBLIC_CLI_PACKAGE_NAME,
      packedVersion: "0.5.0",
      requestedVersion: "0.5.0",
    };
    assert.deepEqual(collectPublicationIdentityIssues(aligned), []);
    assert.ok(
      collectPublicationIdentityIssues({ ...aligned, rootVersion: "0.4.0" }).some((issue) =>
        issue.includes("root version")
      )
    );
    assert.ok(
      collectPublicationIdentityIssues({ ...aligned, packedVersion: "0.5.1" }).some((issue) =>
        issue.includes("packed version")
      )
    );
    assert.ok(
      collectPublicationIdentityIssues({ ...aligned, catalogCurrent: "0.4.0" }).some((issue) =>
        issue.includes("catalog")
      )
    );
  });
});

describe("first npm publication help", () => {
  it("does not hard-code 1.0.0 as the only first-publish tag", () => {
    const source = readFileSync(new URL("../prepare-npm-publish.mjs", import.meta.url), "utf8");
    assert.doesNotMatch(source, /First npm publication of 1\.0\.0/);
    assert.match(source, /canonical Git tag matching the unpublished package version/);
    assert.match(source, /git worktree add \/tmp\/atlas-vX\.Y\.Z vX\.Y\.Z/);
  });
});

describe("npm publication decisions", () => {
  it("treats a missing package as a one-time bootstrap, not an OIDC publish", () => {
    assert.deepEqual(decideNpmPublicationAction({ packageExists: false, versionExists: false }), {
      action: NPM_PUBLICATION_ACTIONS.bootstrapRequired,
      reason:
        "package does not exist on npm; first publication must be a human-authenticated publish of the validated tarball",
    });
  });

  it("noops when the exact version already exists instead of overwriting", () => {
    assert.equal(
      decideNpmPublicationAction({ packageExists: true, versionExists: true }).action,
      NPM_PUBLICATION_ACTIONS.noop
    );
  });

  it("publishes only when the package exists and the version is unpublished", () => {
    assert.equal(
      decideNpmPublicationAction({ packageExists: true, versionExists: false }).action,
      NPM_PUBLICATION_ACTIONS.publish
    );
  });
});

describe("npm registry query", () => {
  const version = "0.5.0";
  const versionUrl = npmRegistryDocumentUrl(PUBLIC_CLI_PACKAGE_NAME, version);
  const packageUrl = npmRegistryDocumentUrl(PUBLIC_CLI_PACKAGE_NAME);

  function fetchByUrl(handlers) {
    return async (url, init) => {
      assert.equal(init?.cache, "no-store");
      assert.equal(init?.headers?.["cache-control"], "no-cache");
      const href = String(url);
      if (href === versionUrl) {
        return handlers.version();
      }
      if (href === packageUrl) {
        return handlers.package();
      }
      throw new Error(`unexpected registry URL ${href}`);
    };
  }

  it("treats HTTP 404 as a missing package without throwing", async () => {
    const result = await queryNpmPackageVersion({
      version,
      fetchImpl: fetchByUrl({
        version: () => new Response("Not Found", { status: 404 }),
        package: () => new Response("Not Found", { status: 404 }),
      }),
    });
    assert.equal(result.packageExists, false);
    assert.equal(result.versionExists, false);
    assert.equal(result.status, "missing-package");
  });

  it("detects an already-published version from the version-specific document", async () => {
    const urls = [];
    const result = await queryNpmPackageVersion({
      version,
      fetchImpl: async (url, init) => {
        urls.push(String(url));
        assert.equal(init?.cache, "no-store");
        return new Response(
          JSON.stringify({ name: PUBLIC_CLI_PACKAGE_NAME, version }),
          { status: 200 }
        );
      },
    });
    assert.deepEqual(urls, [versionUrl]);
    assert.equal(result.packageExists, true);
    assert.equal(result.versionExists, true);
    assert.equal(result.status, "version-exists");
  });

  it("treats a newly published version as present even when package metadata is stale", async () => {
    const result = await queryNpmPackageVersion({
      version,
      fetchImpl: fetchByUrl({
        version: () =>
          new Response(JSON.stringify({ name: PUBLIC_CLI_PACKAGE_NAME, version }), {
            status: 200,
          }),
        package: () => {
          throw new Error("stale package metadata must not be required once the version document exists");
        },
      }),
    });
    assert.equal(result.packageExists, true);
    assert.equal(result.versionExists, true);
    assert.equal(result.status, "version-exists");
  });

  it("detects a missing version of an existing package", async () => {
    const result = await queryNpmPackageVersion({
      version,
      fetchImpl: fetchByUrl({
        version: () => new Response("Not Found", { status: 404 }),
        package: () =>
          new Response(JSON.stringify({ versions: { "0.4.0": {} } }), { status: 200 }),
      }),
    });
    assert.equal(result.packageExists, true);
    assert.equal(result.versionExists, false);
    assert.equal(result.status, "version-missing");
  });

  it("fails closed on registry transport and HTTP errors", async () => {
    await assert.rejects(
      () =>
        queryNpmPackageVersion({
          version,
          fetchImpl: async () => {
            throw new Error("ECONNRESET");
          },
        }),
      /Failed to query npm registry/
    );
    await assert.rejects(
      () =>
        queryNpmPackageVersion({
          version,
          fetchImpl: fetchByUrl({
            version: () => new Response("nope", { status: 500 }),
            package: () => {
              throw new Error("must not fall through after HTTP 500");
            },
          }),
        }),
      /HTTP 500/
    );
  });

  it("fails closed when the version document is malformed", async () => {
    await assert.rejects(
      () =>
        queryNpmPackageVersion({
          version,
          fetchImpl: async () =>
            new Response(JSON.stringify({ versions: { "0.5.0": {} } }), { status: 200 }),
        }),
      /malformed/
    );
  });
});

describe("publication command and toolchain", () => {
  it("prints a first-publish command against the exact tarball, not packages/cli", () => {
    const command = buildManualPublishCommand("/tmp/artifacts/npm/blitzcraftlabs-atlas-0.5.0.tgz");
    assert.equal(
      command,
      "npm publish /tmp/artifacts/npm/blitzcraftlabs-atlas-0.5.0.tgz --access public --ignore-scripts"
    );
    assert.equal(command.includes("packages/cli"), false);
    assert.deepEqual(NPM_PUBLISH_ARGS, ["--access", "public", "--ignore-scripts"]);
    assert.ok(NPM_OIDC_PUBLISH_ARGS.includes("--provenance"));
  });

  it("strips long-lived npm tokens so OIDC cannot fall back to NPM_TOKEN", () => {
    const stripped = stripNpmAuthEnv({
      PATH: "/usr/bin",
      NPM_TOKEN: "secret",
      NODE_AUTH_TOKEN: "secret",
      "//registry.npmjs.org/:_authToken": "secret",
    });
    assert.equal(stripped.PATH, "/usr/bin");
    assert.equal(stripped.NPM_TOKEN, undefined);
    assert.equal(stripped.NODE_AUTH_TOKEN, undefined);
    assert.equal(stripped["//registry.npmjs.org/:_authToken"], undefined);
  });

  it("requires the Trusted Publishing npm CLI without changing consumer Node engines", () => {
    assert.equal(NPM_TRUSTED_PUBLISHING_MIN_NPM, "11.5.1");
    assert.equal(NPM_TRUSTED_PUBLISHING_MIN_NODE, "22.14.0");
    assert.equal(compareDotVersions("11.5.1", "11.5.1"), 0);
    assert.ok(compareDotVersions("11.4.0", "11.5.1") < 0);
    assert.deepEqual(
      collectTrustedPublishingToolchainIssues({ nodeVersion: "22.10.2", npmVersion: "10.9.0" })
        .length,
      2
    );
    assert.deepEqual(
      collectTrustedPublishingToolchainIssues({ nodeVersion: "22.14.0", npmVersion: "11.5.1" }),
      []
    );
  });

  it("writes GitHub outputs without interpolating newlines", () => {
    const file = path.join(mkdtempSync(path.join(os.tmpdir(), "atlas-gha-")), "output");
    writeFileSync(file, "");
    appendGithubOutput("sha256", "abc", { outputFile: file });
    assert.throws(
      () => appendGithubOutput("sha256", "abc\ndef", { outputFile: file }),
      /unsafe GitHub output value/
    );
  });
});

describe("canonical release checkout", () => {
  it("accepts a clean exact v1.0.0 tag checkout", () => {
    assert.deepEqual(
      collectCanonicalReleaseCheckoutIssues({
        expectedTag: "v1.0.0",
        headSha: "abc123",
        exactTag: "v1.0.0",
        taggedSha: "abc123",
        porcelain: "",
      }),
      []
    );
  });

  it("rejects a dirty tree or a checkout that is not the release tag", () => {
    const dirty = collectCanonicalReleaseCheckoutIssues({
      expectedTag: "v1.0.0",
      headSha: "abc123",
      exactTag: "v1.0.0",
      taggedSha: "abc123",
      porcelain: " M packages/cli/README.md",
    });
    assert.match(dirty.join("\n"), /working tree is dirty/);

    const untagged = collectCanonicalReleaseCheckoutIssues({
      expectedTag: "v1.0.0",
      headSha: "abc123",
      exactTag: null,
      taggedSha: "def456",
      porcelain: "",
    });
    assert.match(untagged.join("\n"), /not the exact git tag v1\.0\.0/);

    const wrongTag = collectCanonicalReleaseCheckoutIssues({
      expectedTag: "v1.0.0",
      headSha: "abc123",
      exactTag: "v0.5.0",
      taggedSha: "abc123",
      porcelain: "",
    });
    assert.match(wrongTag.join("\n"), /exact tag is v0\.5\.0, expected v1\.0\.0/);

    const shaMismatch = collectCanonicalReleaseCheckoutIssues({
      expectedTag: "v1.0.0",
      headSha: "abc123",
      exactTag: "v1.0.0",
      taggedSha: "def456",
      porcelain: "",
    });
    assert.match(shaMismatch.join("\n"), /does not match v1\.0\.0 commit/);
  });
});

describe("npm publication orchestration", () => {
  const identity = {
    packageName: PUBLIC_CLI_PACKAGE_NAME,
    version: "1.1.0",
    rootVersion: "1.1.0",
    cliVersion: "1.1.0",
    tag: "v1.1.0",
  };
  const packed = {
    identity,
    checkout: {
      expectedTag: "v1.1.0",
      headSha: "abc123",
      exactTag: "v1.1.0",
      taggedSha: "abc123",
      porcelain: "",
    },
    tarballPath: "/tmp/artifacts/npm/blitzcraftlabs-atlas-1.1.0.tgz",
    tarballName: "blitzcraftlabs-atlas-1.1.0.tgz",
    sha256: "a".repeat(64),
    bytes: 42,
  };

  function silent() {
    return { write() {} };
  }

  async function run(overrides = {}) {
    const calls = { pack: 0, checkout: 0, publish: 0, packOptions: null };
    const result = await runNpmPublication({
      repoRoot: "/tmp/atlas-fake",
      dryRun: true,
      oidc: false,
      githubActions: true,
      nodeVersion: "22.14.0",
      npmVersion: "11.5.1",
      stdout: silent(),
      readIdentity: () => identity,
      assertPrivateWorkspaces: () => {},
      queryRegistry: async () => ({
        packageExists: true,
        versionExists: false,
        status: "version-missing",
      }),
      assertCheckout: () => {
        calls.checkout += 1;
        return packed.checkout;
      },
      packTarball: (options) => {
        calls.pack += 1;
        calls.packOptions = options;
        return packed;
      },
      hashFile: () => packed.sha256,
      publishTarball: () => {
        calls.publish += 1;
      },
      writeManifest: () => {},
      appendOutput: () => {},
      ...overrides,
    });
    return { result, calls };
  }

  it("no-ops an already-published version from untagged later main without packing", async () => {
    const manifests = [];
    const { result, calls } = await run({
      queryRegistry: async () => ({
        packageExists: true,
        versionExists: true,
        status: "version-exists",
      }),
      assertCheckout: () => {
        throw new Error("already-published versions must not require the historical tag");
      },
      packTarball: () => {
        throw new Error("already-published versions must not rebuild a historical tarball");
      },
      writeManifest: (_file, data) => {
        manifests.push(data);
      },
    });
    assert.equal(result.action, NPM_PUBLICATION_ACTIONS.noop);
    assert.equal(result.packed, null);
    assert.equal(calls.pack, 0);
    assert.equal(calls.publish, 0);
    assert.deepEqual(manifests, []);
  });

  it("fails closed before packing when the npm version is missing and HEAD is untagged", async () => {
    const packCalls = { count: 0 };
    await assert.rejects(
      () =>
        run({
          assertCheckout: () => {
            throw new Error(
              "Refusing to pack a non-canonical checkout for v1.1.0:\nHEAD is not the exact git tag v1.1.0"
            );
          },
          packTarball: () => {
            packCalls.count += 1;
            throw new Error("must not pack an untagged checkout");
          },
        }),
      /not the exact git tag v1\.1\.0/
    );
    assert.equal(packCalls.count, 0);
  });

  it("fails closed when the npm version is missing and HEAD has the wrong tag", async () => {
    await assert.rejects(
      () =>
        run({
          assertCheckout: () => {
            throw new Error(
              "Refusing to pack a non-canonical checkout for v1.1.0:\nexact tag is v1.0.0, expected v1.1.0"
            );
          },
          packTarball: () => {
            throw new Error("must not pack from the wrong tag");
          },
        }),
      /exact tag is v1\.0\.0/
    );
  });

  it("fails closed when the npm version is missing and the exact-tag checkout is dirty", async () => {
    await assert.rejects(
      () =>
        run({
          assertCheckout: () => {
            throw new Error(
              "Refusing to pack a non-canonical checkout for v1.1.0:\nworking tree is dirty; pack the canonical release tag, not a local worktree"
            );
          },
          packTarball: () => {
            throw new Error("must not pack a dirty checkout");
          },
        }),
      /working tree is dirty/
    );
  });

  it("bootstraps from a clean exact tag when the package itself is missing", async () => {
    const { result, calls } = await run({
      queryRegistry: async () => ({
        packageExists: false,
        versionExists: false,
        status: "missing-package",
      }),
    });
    assert.equal(result.action, NPM_PUBLICATION_ACTIONS.bootstrapRequired);
    assert.equal(calls.checkout, 1);
    assert.equal(calls.pack, 1);
    assert.equal(calls.packOptions.requireReleaseTag, true);
    assert.equal(calls.publish, 0);
    assert.equal(result.packed.sha256, packed.sha256);
  });

  it("can OIDC-publish from a clean exact tag when the package exists and the version is missing", async () => {
    const { result, calls } = await run({
      dryRun: false,
      oidc: true,
      githubActions: true,
    });
    assert.equal(result.action, NPM_PUBLICATION_ACTIONS.publish);
    assert.equal(calls.checkout, 1);
    assert.equal(calls.pack, 1);
    assert.equal(calls.packOptions.requireReleaseTag, true);
    assert.equal(calls.publish, 1);
  });

  it("refuses OIDC publish outside GitHub Actions", async () => {
    await assert.rejects(
      () =>
        run({
          dryRun: false,
          oidc: true,
          githubActions: false,
        }),
      /outside GitHub Actions/
    );
  });

  it("refuses a substituted tarball after validation", async () => {
    await assert.rejects(
      () =>
        run({
          dryRun: false,
          oidc: true,
          githubActions: true,
          hashFile: () => "b".repeat(64),
          publishTarball: () => {
            throw new Error("must not publish a substituted tarball");
          },
        }),
      /Packed tarball changed after validation/
    );
  });
});

describe("exact tarball publish", () => {
  it("refuses to publish a tarball whose SHA-256 no longer matches", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "atlas-npm-sub-"));
    const tarballPath = path.join(dir, "blitzcraftlabs-atlas-1.1.0.tgz");
    writeFileSync(tarballPath, "canonical-bytes");
    const expectedSha256 = hashFileSha256(tarballPath);
    writeFileSync(tarballPath, "substituted-bytes");
    assert.throws(
      () =>
        publishExactTarball({
          tarballPath,
          expectedSha256,
          cwd: dir,
          provenance: true,
        }),
      /substituted tarball/
    );
  });
});
