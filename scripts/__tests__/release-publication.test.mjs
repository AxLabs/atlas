import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { generateSpdxSbom } from "../generate-sbom.mjs";
import { preparePublication } from "../publish-atlas-release.mjs";
import {
  PublicationError,
  REQUIRED_RELEASE_CHECK_WORKFLOWS,
  buildCanonicalReleaseNotes,
  collectVersionConsistencyErrors,
  evaluatePublicationDecision,
  evaluateRequiredReleaseChecks,
  isFirstCanonicalPublicRelease,
  isHistoricalUnpublishedVersion,
  publicationSideEffects,
  sbomAssetNameForCommit,
  tagNameForVersion,
} from "../release-publication.mjs";

const alignedWorkspaces = [
  { name: "@atlas/web", version: "0.2.0" },
  { name: "@atlas/ui", version: "0.2.0" },
];

const changelog020 = `# Changelog

## [Unreleased]

## [0.2.0] - 2026-09-11

### Added
- First public release automation

## 0.1.0 - 2026-08-19

### Added
- Historical snapshot
`;

describe("version consistency", () => {
  it("fails when root version != workspace fixed-group version", () => {
    const errors = collectVersionConsistencyErrors({
      rootVersion: "0.2.0",
      workspaceVersions: [
        { name: "@atlas/web", version: "0.2.0" },
        { name: "@atlas/ui", version: "0.1.0" },
      ],
      changelog: changelog020,
    });
    assert.match(errors.join("\n"), /@atlas\/ui is 0\.1\.0/);
  });

  it("fails when changelog version != package version", () => {
    const errors = collectVersionConsistencyErrors({
      rootVersion: "0.2.0",
      workspaceVersions: alignedWorkspaces,
      changelog: "## [0.1.0]\n\n- old\n",
    });
    assert.match(errors.join("\n"), /no section for current Atlas version 0\.2\.0/);
  });

  it("fails when tag version != package version", () => {
    const errors = collectVersionConsistencyErrors({
      rootVersion: "0.2.0",
      workspaceVersions: alignedWorkspaces,
      changelog: changelog020,
      proposedTag: "v0.3.0",
    });
    assert.match(errors.join("\n"), /Tag v0\.3\.0 does not match package version 0\.2\.0/);
  });
});

describe("publication decision", () => {
  it("no-ops without publication for the historical 0.1.0 snapshot", () => {
    const decision = evaluatePublicationDecision({
      rootVersion: "0.1.0",
      workspaceVersions: [
        { name: "@atlas/web", version: "0.1.0" },
        { name: "@atlas/ui", version: "0.1.0" },
      ],
      changelog: "## 0.1.0 - 2026-08-19\n\n### Added\n- Historical snapshot\n",
      targetSha: "abc",
      canonicalMainSha: "abc",
    });
    assert.equal(decision.action, "noop");
    assert.match(decision.reason, /historical internal snapshot/);
    assert.equal(isHistoricalUnpublishedVersion("0.1.0"), true);
  });

  it("no-ops historical 0.1.0 even when pending changesets remain", () => {
    const decision = evaluatePublicationDecision({
      rootVersion: "0.1.0",
      workspaceVersions: [
        { name: "@atlas/web", version: "0.1.0" },
        { name: "@atlas/ui", version: "0.1.0" },
      ],
      changelog: "## 0.1.0 - 2026-08-19\n\n### Added\n- Historical snapshot\n",
      pendingChangesetFiles: ["public-release-automation.md"],
      targetSha: "abc",
      canonicalMainSha: "abc",
    });
    assert.equal(decision.action, "noop");
  });

  it("fails when a non-historical version still has pending changesets", () => {
    assert.throws(
      () =>
        evaluatePublicationDecision({
          rootVersion: "0.2.0",
          workspaceVersions: alignedWorkspaces,
          changelog: changelog020,
          pendingChangesetFiles: ["foo.md", "bar.md"],
          targetSha: "abc",
          canonicalMainSha: "abc",
        }),
      (error) =>
        error instanceof PublicationError &&
        error.code === "PENDING_CHANGESETS" &&
        /Cannot publish v0\.2\.0 while pending changesets remain/.test(error.message) &&
        /- foo\.md/.test(error.message) &&
        /- bar\.md/.test(error.message)
    );
  });

  it("publishes 0.2.0 when no pending changesets remain", () => {
    const decision = evaluatePublicationDecision({
      rootVersion: "0.2.0",
      workspaceVersions: alignedWorkspaces,
      changelog: changelog020,
      pendingChangesetFiles: [],
      targetSha: "abc",
      canonicalMainSha: "abc",
    });
    assert.equal(decision.action, "publish");
    assert.equal(decision.tag, "v0.2.0");
  });

  it("fails when the target tag already exists at a different SHA", () => {
    assert.throws(
      () =>
        evaluatePublicationDecision({
          rootVersion: "0.2.0",
          workspaceVersions: alignedWorkspaces,
          changelog: changelog020,
          existingTags: [{ name: "v0.2.0", sha: "oldsha" }],
          targetSha: "newsha",
          canonicalMainSha: "newsha",
        }),
      (error) => error instanceof PublicationError && error.code === "TAG_EXISTS"
    );
  });

  it("fails when the GitHub Release already exists for a different SHA", () => {
    assert.throws(
      () =>
        evaluatePublicationDecision({
          rootVersion: "0.2.0",
          workspaceVersions: alignedWorkspaces,
          changelog: changelog020,
          existingTags: [{ name: "v0.2.0", sha: "newsha" }],
          existingReleases: [{ tagName: "v0.2.0", sha: "oldsha" }],
          targetSha: "newsha",
          canonicalMainSha: "newsha",
        }),
      (error) => error instanceof PublicationError && error.code === "RELEASE_EXISTS"
    );
  });

  it("no-ops when tag, Release, and required SBOM exist at this SHA", () => {
    const decision = evaluatePublicationDecision({
      rootVersion: "0.2.0",
      workspaceVersions: alignedWorkspaces,
      changelog: changelog020,
      existingTags: [{ name: "v0.2.0", sha: "abc" }],
      existingReleases: [
        {
          tagName: "v0.2.0",
          sha: "abc",
          assets: [sbomAssetNameForCommit("abc"), "LICENSE"],
        },
      ],
      targetSha: "abc",
      canonicalMainSha: "abc",
    });
    assert.equal(decision.action, "noop");
    assert.match(decision.reason, /already exist/);
  });

  it("repairs assets when the Release exists but the required SBOM is missing", () => {
    const decision = evaluatePublicationDecision({
      rootVersion: "0.2.0",
      workspaceVersions: alignedWorkspaces,
      changelog: changelog020,
      existingTags: [{ name: "v0.2.0", sha: "abc" }],
      existingReleases: [{ tagName: "v0.2.0", sha: "abc", assets: ["LICENSE"] }],
      targetSha: "abc",
      canonicalMainSha: "abc",
    });
    assert.equal(decision.action, "repair-assets");
    assert.deepEqual(decision.missingAssets, [sbomAssetNameForCommit("abc")]);
    assert.equal(publicationSideEffects(decision.action).createTag, false);
  });

  it("repairs the Release when only the tag exists at the correct SHA", () => {
    const decision = evaluatePublicationDecision({
      rootVersion: "0.2.0",
      workspaceVersions: alignedWorkspaces,
      changelog: changelog020,
      existingTags: [{ name: "v0.2.0", sha: "abc" }],
      existingReleases: [],
      targetSha: "abc",
      canonicalMainSha: "abc",
    });
    assert.equal(decision.action, "repair-release");
    assert.equal(publicationSideEffects(decision.action).createTag, false);
    assert.equal(publicationSideEffects(decision.action).createRelease, true);
  });

  it("fails when a GitHub Release exists without a matching tag", () => {
    assert.throws(
      () =>
        evaluatePublicationDecision({
          rootVersion: "0.2.0",
          workspaceVersions: alignedWorkspaces,
          changelog: changelog020,
          existingTags: [],
          existingReleases: [
            {
              tagName: "v0.2.0",
              sha: "abc",
              assets: [sbomAssetNameForCommit("abc")],
            },
          ],
          targetSha: "abc",
          canonicalMainSha: "abc",
        }),
      (error) => error instanceof PublicationError && error.code === "RELEASE_WITHOUT_TAG"
    );
  });

  it("publishes when a non-historical version has no tag or release", () => {
    const decision = evaluatePublicationDecision({
      rootVersion: "0.2.0",
      workspaceVersions: alignedWorkspaces,
      changelog: changelog020,
      targetSha: "abc",
      canonicalMainSha: "abc",
    });
    assert.equal(decision.action, "publish");
    assert.equal(decision.tag, "v0.2.0");
  });

  it("fails when pending version metadata is inconsistent", () => {
    assert.throws(
      () =>
        evaluatePublicationDecision({
          rootVersion: "0.2.0",
          workspaceVersions: [{ name: "@atlas/web", version: "0.1.1" }],
          changelog: changelog020,
        }),
      (error) => error instanceof PublicationError && error.code === "INVALID_RELEASE_STATE"
    );
  });

  it("fails when the target SHA is not canonical main", () => {
    assert.throws(
      () =>
        evaluatePublicationDecision({
          rootVersion: "0.2.0",
          workspaceVersions: alignedWorkspaces,
          changelog: changelog020,
          targetSha: "feature",
          canonicalMainSha: "mainsha",
        }),
      (error) => error instanceof PublicationError && error.code === "STALE_SHA"
    );
  });

  it("never creates a tag on repair actions", () => {
    assert.equal(publicationSideEffects("publish").createTag, true);
    assert.equal(publicationSideEffects("repair-release").createTag, false);
    assert.equal(publicationSideEffects("repair-assets").createTag, false);
    assert.equal(publicationSideEffects("repair-assets").clobberExactAssets, true);
    assert.equal(publicationSideEffects("publish").clobberExactAssets, false);
  });
});

describe("required release checks", () => {
  const sha = "abc123def456abc123def456abc123def456abcd";

  it("requires CI, Security Audit, and UI Quality", () => {
    assert.deepEqual([...REQUIRED_RELEASE_CHECK_WORKFLOWS], ["CI", "Security Audit", "UI Quality"]);
  });

  it("accepts success only for the exact target SHA", () => {
    const result = evaluateRequiredReleaseChecks(
      [
        {
          name: "CI",
          conclusion: "success",
          status: "completed",
          headSha: "ffffffffffffffffffffffffffffffffffffffff",
        },
        { name: "CI", conclusion: "success", status: "completed", headSha: sha },
        { name: "Security Audit", conclusion: "success", status: "completed", headSha: sha },
        { name: "UI Quality", conclusion: "success", status: "completed", headSha: sha },
      ],
      { commitSha: sha }
    );
    assert.deepEqual(result.failed, []);
    assert.deepEqual(result.pending, []);
  });

  it("ignores a successful run from another SHA", () => {
    const result = evaluateRequiredReleaseChecks(
      [
        {
          name: "CI",
          conclusion: "success",
          status: "completed",
          headSha: "ffffffffffffffffffffffffffffffffffffffff",
        },
        { name: "Security Audit", conclusion: "success", status: "completed", headSha: sha },
        { name: "UI Quality", conclusion: "success", status: "completed", headSha: sha },
      ],
      { commitSha: sha }
    );
    assert.deepEqual(result.pending, ["CI"]);
  });

  it("fails closed on cancelled or failed required runs without a successful retry", () => {
    const cancelled = evaluateRequiredReleaseChecks(
      [{ name: "CI", conclusion: "cancelled", status: "completed", headSha: sha }],
      { commitSha: sha }
    );
    assert.equal(cancelled.failed[0]?.conclusion, "cancelled");

    const failed = evaluateRequiredReleaseChecks(
      [{ name: "UI Quality", conclusion: "failure", status: "completed", headSha: sha }],
      { commitSha: sha }
    );
    assert.equal(failed.failed[0]?.conclusion, "failure");
  });

  it("treats a later successful retry on the same SHA as resolved", () => {
    const result = evaluateRequiredReleaseChecks(
      [
        { name: "CI", conclusion: "failure", status: "completed", headSha: sha },
        { name: "CI", conclusion: "success", status: "completed", headSha: sha },
        { name: "Security Audit", conclusion: "success", status: "completed", headSha: sha },
        { name: "UI Quality", conclusion: "success", status: "completed", headSha: sha },
      ],
      { commitSha: sha }
    );
    assert.deepEqual(result.failed, []);
    assert.deepEqual(result.pending, []);
  });

  it("keeps waiting when a required workflow is still pending", () => {
    const result = evaluateRequiredReleaseChecks(
      [
        { name: "CI", conclusion: "success", status: "completed", headSha: sha },
        { name: "Security Audit", conclusion: null, status: "in_progress", headSha: sha },
      ],
      { commitSha: sha }
    );
    assert.deepEqual(result.failed, []);
    assert.deepEqual(result.pending, ["Security Audit", "UI Quality"]);
  });
});

describe("release notes", () => {
  it("frames the first canonical public release without claiming npm or provenance", () => {
    const notes = buildCanonicalReleaseNotes(changelog020, "0.2.0", {
      commitSha: "abc123",
      sbomFileName: "atlas-sbom-abc123.spdx.json",
      firstCanonicalPublicRelease: true,
    });
    assert.match(notes, /first canonical public GitHub Release/);
    assert.match(notes, /historical internal snapshot/);
    assert.match(notes, /Commit: `abc123`/);
    assert.match(notes, /\*\*not\*\* published to npm/);
    assert.match(notes, /does \*\*not\*\* include signed provenance, SLSA attestation/);
  });

  it("detects first canonical public release from empty GitHub state", () => {
    assert.equal(isFirstCanonicalPublicRelease({ existingTags: [], existingReleases: [] }), true);
    assert.equal(
      isFirstCanonicalPublicRelease({
        existingTags: [{ name: "v0.2.0" }],
        existingReleases: [],
      }),
      false
    );
  });
});

describe("SBOM generation failures", () => {
  it("fails visibly when the lockfile has no packages", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "atlas-sbom-empty-"));
    writeFileSync(path.join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\npackages: {}\n");
    assert.throws(
      () => generateSpdxSbom({ root: dir, commitSha: "deadbeef" }),
      /SBOM generation found no packages/
    );
  });
});

describe("preparePublication dry-run", () => {
  it("writes notes and SBOM without requiring GitHub when state is provided", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "atlas-publish-dry-"));
    const outputDir = path.join(dir, "artifacts");
    writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "@atlas/monorepo", version: "0.2.0", private: true })
    );
    mkdirSync(path.join(dir, "apps/web"), { recursive: true });
    mkdirSync(path.join(dir, "packages/ui"), { recursive: true });
    mkdirSync(path.join(dir, "packages/config"), { recursive: true });
    mkdirSync(path.join(dir, "packages/consent"), { recursive: true });
    mkdirSync(path.join(dir, "packages/project"), { recursive: true });
    mkdirSync(path.join(dir, "packages/cli"), { recursive: true });
    mkdirSync(path.join(dir, "apps/reference"), { recursive: true });
    writeFileSync(
      path.join(dir, "apps/web/package.json"),
      JSON.stringify({ name: "@atlas/web", version: "0.2.0", private: true })
    );
    writeFileSync(
      path.join(dir, "packages/ui/package.json"),
      JSON.stringify({ name: "@atlas/ui", version: "0.2.0", private: true })
    );
    writeFileSync(
      path.join(dir, "packages/config/package.json"),
      JSON.stringify({ name: "@atlas/config", version: "0.2.0", private: true })
    );
    writeFileSync(
      path.join(dir, "packages/consent/package.json"),
      JSON.stringify({ name: "@atlas/consent", version: "0.2.0", private: true })
    );
    writeFileSync(
      path.join(dir, "packages/project/package.json"),
      JSON.stringify({ name: "@atlas/project", version: "0.2.0", private: true })
    );
    writeFileSync(
      path.join(dir, "packages/cli/package.json"),
      JSON.stringify({ name: "@atlas/cli", version: "0.2.0", private: true })
    );
    writeFileSync(
      path.join(dir, "apps/reference/package.json"),
      JSON.stringify({ name: "@atlas/reference", version: "0.2.0", private: true })
    );
    writeFileSync(path.join(dir, "CHANGELOG.md"), changelog020);
    writeFileSync(
      path.join(dir, "pnpm-lock.yaml"),
      `lockfileVersion: '9.0'\npackages:\n  'example@1.0.0':\n    resolution: {integrity: sha512-test}\n`
    );
    const stateFile = path.join(dir, "state.json");
    writeFileSync(
      stateFile,
      JSON.stringify({
        existingTags: [],
        existingReleases: [],
        canonicalMainSha: "abc123",
      })
    );

    const prepared = preparePublication({
      repoRoot: dir,
      stateFile,
      skipGithub: false,
      dryRun: true,
      outputDir,
      targetSha: "abc123",
    });

    assert.equal(prepared.decision.action, "publish");
    assert.equal(prepared.decision.tag, tagNameForVersion("0.2.0"));
    assert.match(prepared.notes, /Atlas 0\.2\.0/);
    assert.equal(prepared.sbom.packageCount > 0, true);
  });
});
