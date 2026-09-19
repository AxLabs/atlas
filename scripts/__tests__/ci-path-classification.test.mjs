import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isPackageManifestPath,
  isReleaseMetadataPath,
  isReleaseOnlyChange,
  normalizeRepoPath,
} from "../lib/ci-path-classification.mjs";

describe("CI path classification helpers", () => {
  it("treats changesets, changelogs, and generated production snapshots as release metadata", () => {
    assert.equal(isReleaseMetadataPath(".changeset/cool-fox.md"), true);
    assert.equal(isReleaseMetadataPath("CHANGELOG.md"), true);
    assert.equal(isReleaseMetadataPath("packages/cli/CHANGELOG.md"), true);
    assert.equal(
      isReleaseMetadataPath(
        "packages/cli/release-assets/production/1.0.0/apps/web/src/app/page.tsx"
      ),
      true
    );
    assert.equal(isReleaseMetadataPath("apps/web/src/app/page.tsx"), false);
  });

  it("classifies a changeset version PR as release-only", () => {
    assert.equal(
      isReleaseOnlyChange([
        ".changeset/cool-fox.md",
        "CHANGELOG.md",
        "packages/cli/CHANGELOG.md",
        "package.json",
        "apps/web/package.json",
        "packages/ui/package.json",
        "packages/cli/release-assets/production/1.0.0/release.snapshot.json",
      ]),
      true
    );
  });

  it("does not treat a package.json-only dependency edit as release-only", () => {
    assert.equal(isPackageManifestPath("packages/ui/package.json"), true);
    assert.equal(isReleaseOnlyChange(["packages/ui/package.json"]), false);
    assert.equal(normalizeRepoPath("./apps/web/src/app/page.tsx"), "apps/web/src/app/page.tsx");
  });
});
