import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PUBLIC_CLI_PACKAGE_NAME } from "../atlas-workspaces.mjs";
import {
  assertPublicCliManifest,
  collectPackedFileIssues,
  collectRuntimeWorkspaceProtocolLeaks,
  detectNpmAuthRequirement,
  extractJsonPayload,
  NPM_PACK_DRY_RUN_ARGS,
  NPM_PUBLISH_DRY_RUN_ARGS,
  normalizeNpmPackPayload,
} from "../lib/npm-publish-dry-run.mjs";

function publicManifest(overrides = {}) {
  return {
    name: PUBLIC_CLI_PACKAGE_NAME,
    version: "0.4.0",
    license: "Apache-2.0",
    bin: { atlas: "./dist/cli.js" },
    engines: { node: ">=22.0.0" },
    repository: {
      type: "git",
      url: "git+https://github.com/blitzcraftlabs/atlas.git",
      directory: "packages/cli",
    },
    publishConfig: { access: "public" },
    dependencies: { zod: "3.24.1" },
    devDependencies: { "@atlas/project": "workspace:*" },
    ...overrides,
  };
}

describe("npm publish dry-run helpers", () => {
  it("accepts the public CLI manifest while allowing workspace-only devDependencies", () => {
    assert.deepEqual(assertPublicCliManifest(publicManifest()), []);
    assert.deepEqual(collectRuntimeWorkspaceProtocolLeaks(publicManifest()), []);
  });

  it("rejects private, restricted, or misnamed packages and runtime workspace leaks", () => {
    assert.ok(
      assertPublicCliManifest(publicManifest({ private: true })).some((issue) =>
        /private/.test(issue)
      )
    );
    assert.ok(
      assertPublicCliManifest(publicManifest({ name: "@atlas/cli" })).some((issue) =>
        issue.includes(PUBLIC_CLI_PACKAGE_NAME)
      )
    );
    assert.ok(
      assertPublicCliManifest(publicManifest({ publishConfig: { access: "restricted" } })).some(
        (issue) => /publishConfig\.access/.test(issue)
      )
    );
    assert.ok(
      collectRuntimeWorkspaceProtocolLeaks(
        publicManifest({ dependencies: { "@atlas/project": "workspace:*" } })
      ).some((issue) => issue.includes("@atlas/project"))
    );
  });

  it("requires packed runtime files and rejects source-only noise", () => {
    const files = [
      "package.json",
      "dist/cli.js",
      "dist/index.js",
      "dist/dependency-validation.js",
      "dist/bootstrap-assets.js",
      "dist/release-assets.js",
      "LICENSE",
      "README.md",
      "THIRD_PARTY_NOTICES.md",
      "assets/bootstrap/manifest.json",
      "assets/releases/catalog.json",
    ];
    assert.deepEqual(collectPackedFileIssues(files), []);
    assert.equal(
      collectPackedFileIssues([...files, "assets/bootstrap/files/apps/web/.env.example"]).length,
      0
    );
    assert.ok(
      collectPackedFileIssues([...files, ".env.local"]).some((issue) => issue.includes("env"))
    );
    assert.ok(
      collectPackedFileIssues([...files, "src/cli.ts"]).some((issue) => issue.includes("src"))
    );
    assert.ok(
      collectPackedFileIssues(files.filter((file) => file !== "LICENSE")).some((issue) =>
        /LICENSE/.test(issue)
      )
    );
  });

  it("parses npm pack JSON and detects unexpected auth requirements", () => {
    const payload = extractJsonPayload(
      'npm notice\n{"name":"@blitzcraftlabs/atlas","version":"0.4.0","files":[{"path":"package.json"}]}'
    );
    const normalized = normalizeNpmPackPayload(payload);
    assert.equal(normalized.name, PUBLIC_CLI_PACKAGE_NAME);
    assert.deepEqual(normalized.files, ["package.json"]);
    assert.equal(detectNpmAuthRequirement("npm ERR! code ENEEDAUTH", 1), true);
    assert.equal(
      detectNpmAuthRequirement(
        "npm warn This command requires you to be logged in to https://registry.npmjs.org/ (dry-run)\n+ @blitzcraftlabs/atlas@0.4.0",
        0
      ),
      false
    );
    assert.equal(detectNpmAuthRequirement("npm notice total files: 12", 0), false);
  });

  it("uses dry-run pack and public dry-run publish arguments", () => {
    assert.deepEqual(NPM_PACK_DRY_RUN_ARGS, ["pack", "--dry-run", "--json", "--ignore-scripts"]);
    assert.deepEqual(NPM_PUBLISH_DRY_RUN_ARGS, ["publish", "--dry-run", "--access", "public"]);
  });
});
