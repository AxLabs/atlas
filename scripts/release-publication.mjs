/**
 * Fail-closed Atlas GitHub Release publication decisions.
 *
 * Pure functions — no Git or GitHub side effects. The CLI wrapper
 * (`publish-atlas-release.mjs`) applies these decisions.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { ATLAS_TAG_PATTERN, readRootVersion, readWorkspaceVersions } from "./atlas-workspaces.mjs";
import { extractChangelogSection } from "./extract-changelog-section.mjs";
import { assertPreOnePointZero, isGithubPrerelease, parseSemver } from "./semver-utils.mjs";

/** Internal snapshot that must never receive a public tag or GitHub Release. */
export const HISTORICAL_UNPUBLISHED_VERSIONS = Object.freeze(["0.1.0"]);

export const REQUIRED_RELEASE_CHECK_WORKFLOWS = Object.freeze([
  "CI",
  "Security Audit",
  "UI Quality",
]);

export const REQUIRED_RELEASE_ASSET_LICENSE = "LICENSE";

export class PublicationError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string }} [options]
   */
  constructor(message, options = {}) {
    super(message);
    this.name = "PublicationError";
    this.code = options.code ?? "INVALID_RELEASE_STATE";
  }
}

export function tagNameForVersion(version) {
  return `v${version}`;
}

export function sbomAssetNameForCommit(commitSha) {
  return `atlas-sbom-${commitSha}.spdx.json`;
}

/**
 * Canonical Release assets that must exist before publication is complete.
 * SBOM is mandatory; LICENSE is uploaded with every canonical Release.
 *
 * @param {string} commitSha
 * @returns {string[]}
 */
export function requiredReleaseAssetNames(commitSha) {
  return [sbomAssetNameForCommit(commitSha), REQUIRED_RELEASE_ASSET_LICENSE];
}

/**
 * @param {{ assets?: string[] } | null | undefined} release
 * @param {string} commitSha
 * @returns {string[]}
 */
export function missingRequiredReleaseAssets(release, commitSha) {
  const assets = new Set(release?.assets ?? []);
  return [sbomAssetNameForCommit(commitSha)].filter((name) => !assets.has(name));
}

/**
 * Live side effects for a publication decision. Repair never creates a new tag.
 *
 * @param {"publish" | "repair-release" | "repair-assets" | "noop"} action
 */
export function publicationSideEffects(action) {
  return {
    createTag: action === "publish",
    createRelease: action === "publish" || action === "repair-release",
    uploadAssets: action === "publish" || action === "repair-release" || action === "repair-assets",
    clobberExactAssets: action === "repair-assets",
  };
}

/**
 * Evaluate required workflow runs for one exact commit.
 * `--commit <sha>` is the primary filter; `headSha` is a defense-in-depth check.
 *
 * A workflow is successful when at least one completed run on this SHA succeeded.
 * Prior unsuccessful completed runs on the same SHA are treated as resolved by that retry.
 * Cancelled, failed, or other unsuccessful conclusions without a later success fail closed.
 *
 * @param {Array<{ name?: string, workflowName?: string, conclusion?: string | null, status?: string | null, headSha?: string | null }>} runs
 * @param {{ requiredWorkflows?: readonly string[], commitSha: string }} options
 * @returns {{ failed: Array<{ name: string, conclusion: string }>, pending: string[] }}
 */
export function evaluateRequiredReleaseChecks(runs, options) {
  const requiredWorkflows = [...(options.requiredWorkflows ?? REQUIRED_RELEASE_CHECK_WORKFLOWS)];
  const commitSha = options.commitSha;
  const relevant = (runs ?? []).filter((run) => {
    const name = run.name ?? run.workflowName;
    if (!name || !requiredWorkflows.includes(name)) {
      return false;
    }
    if (run.headSha && run.headSha !== commitSha) {
      return false;
    }
    return true;
  });

  const failed = [];
  const pending = [];

  for (const name of requiredWorkflows) {
    const workflowRuns = relevant.filter((run) => (run.name ?? run.workflowName) === name);
    const completed = workflowRuns.filter(
      (run) => run.status === "completed" || Boolean(run.conclusion)
    );
    const successful = completed.filter((run) => run.conclusion === "success");
    const unsuccessful = completed.filter(
      (run) => run.conclusion && run.conclusion !== "success"
    );

    if (successful.length > 0) {
      continue;
    }
    if (unsuccessful.length > 0) {
      failed.push(
        ...unsuccessful.map((run) => ({
          name,
          conclusion: run.conclusion ?? "unknown",
        }))
      );
      continue;
    }

    pending.push(name);
  }

  return { failed, pending };
}

export function isHistoricalUnpublishedVersion(version) {
  return HISTORICAL_UNPUBLISHED_VERSIONS.includes(version);
}

export function listPendingChangesetFiles(repoRoot = process.cwd()) {
  const directory = path.join(repoRoot, ".changeset");
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory)
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .sort();
}

/**
 * @param {{
 *   rootVersion: string,
 *   workspaceVersions: Array<{ name: string, version: string }>,
 *   changelog: string,
 *   proposedTag?: string | null,
 * }} input
 * @returns {string[]}
 */
export function collectVersionConsistencyErrors(input) {
  const errors = [];
  const { rootVersion, workspaceVersions, changelog, proposedTag } = input;

  if (!parseSemver(rootVersion)) {
    errors.push(`Invalid root/platform version "${rootVersion}"`);
    return errors;
  }

  try {
    assertPreOnePointZero(rootVersion);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  for (const pkg of workspaceVersions) {
    if (pkg.version !== rootVersion) {
      errors.push(`Version mismatch: root is ${rootVersion}, ${pkg.name} is ${pkg.version}`);
    }
  }

  if (!extractChangelogSection(changelog, rootVersion)) {
    errors.push(`CHANGELOG.md has no section for current Atlas version ${rootVersion}`);
  }

  if (proposedTag) {
    if (!ATLAS_TAG_PATTERN.test(proposedTag)) {
      errors.push(`Invalid Atlas tag format "${proposedTag}" (expected vX.Y.Z)`);
    }
    if (proposedTag !== tagNameForVersion(rootVersion)) {
      errors.push(`Tag ${proposedTag} does not match package version ${rootVersion}`);
    }
  }

  return errors;
}

/**
 * @param {{
 *   rootVersion: string,
 *   workspaceVersions: Array<{ name: string, version: string }>,
 *   changelog: string,
 *   existingTags?: Array<{ name: string, sha?: string | null }>,
 *   existingReleases?: Array<{ tagName: string, sha?: string | null, assets?: string[] }>,
 *   proposedTag?: string | null,
 *   targetSha?: string | null,
 *   canonicalMainSha?: string | null,
 *   pendingChangesetFiles?: string[],
 * }} input
 */
export function evaluatePublicationDecision(input) {
  const errors = collectVersionConsistencyErrors(input);
  if (errors.length > 0) {
    throw new PublicationError(errors.join("\n"), { code: "INVALID_RELEASE_STATE" });
  }

  const { rootVersion } = input;
  const tag = tagNameForVersion(rootVersion);
  const existingTags = input.existingTags ?? [];
  const existingReleases = input.existingReleases ?? [];
  const existingTag = existingTags.find((entry) => entry.name === tag);
  const existingRelease = existingReleases.find((entry) => entry.tagName === tag);
  const pendingChangesetFiles = input.pendingChangesetFiles ?? [];

  if (isHistoricalUnpublishedVersion(rootVersion)) {
    return {
      action: "noop",
      version: rootVersion,
      tag,
      prerelease: isGithubPrerelease(rootVersion),
      reason: `${rootVersion} is a historical internal snapshot and must not receive a public tag or GitHub Release`,
    };
  }

  if (pendingChangesetFiles.length > 0) {
    throw new PublicationError(
      `Cannot publish ${tag} while pending changesets remain:\n${pendingChangesetFiles
        .map((name) => `- ${name}`)
        .join("\n")}`,
      { code: "PENDING_CHANGESETS" }
    );
  }

  if (input.targetSha && input.canonicalMainSha && input.targetSha !== input.canonicalMainSha) {
    throw new PublicationError(
      `Target SHA ${input.targetSha} is not the current canonical main (${input.canonicalMainSha})`,
      { code: "STALE_SHA" }
    );
  }

  if (existingTag?.sha && input.targetSha && existingTag.sha !== input.targetSha) {
    throw new PublicationError(
      `Tag ${tag} already exists at ${existingTag.sha}; refusing to retag ${input.targetSha}`,
      { code: "TAG_EXISTS" }
    );
  }

  if (existingRelease?.sha && input.targetSha && existingRelease.sha !== input.targetSha) {
    throw new PublicationError(
      `GitHub Release ${tag} already exists for ${existingRelease.sha}; refusing to recreate for ${input.targetSha}`,
      { code: "RELEASE_EXISTS" }
    );
  }

  if (!existingTag && existingRelease) {
    throw new PublicationError(`GitHub Release ${tag} exists without a matching git tag`, {
      code: "RELEASE_WITHOUT_TAG",
    });
  }

  if (existingTag && existingRelease) {
    const missingAssets = missingRequiredReleaseAssets(existingRelease, input.targetSha ?? "");
    if (missingAssets.length > 0) {
      return {
        action: "repair-assets",
        version: rootVersion,
        tag,
        prerelease: isGithubPrerelease(rootVersion),
        missingAssets,
        reason: `GitHub Release ${tag} exists at the release commit but is missing required assets: ${missingAssets.join(", ")}`,
      };
    }

    return {
      action: "noop",
      version: rootVersion,
      tag,
      prerelease: isGithubPrerelease(rootVersion),
      reason: `Tag ${tag} and GitHub Release already exist with required assets for this version`,
    };
  }

  if (existingTag && !existingRelease) {
    return {
      action: "repair-release",
      version: rootVersion,
      tag,
      prerelease: isGithubPrerelease(rootVersion),
      reason: `Tag ${tag} exists at the release commit; creating the missing GitHub Release`,
    };
  }

  return {
    action: "publish",
    version: rootVersion,
    tag,
    prerelease: isGithubPrerelease(rootVersion),
    reason: `Canonical public release ${tag} does not exist yet`,
  };
}

/**
 * @param {string} changelog
 * @param {string} version
 * @param {{
 *   commitSha?: string,
 *   sbomFileName?: string,
 *   firstCanonicalPublicRelease?: boolean,
 * }} [options]
 */
export function buildCanonicalReleaseNotes(changelog, version, options = {}) {
  const section = extractChangelogSection(changelog, version);
  if (!section) {
    throw new PublicationError(
      `No changelog section found for Atlas version ${version} in CHANGELOG.md`,
      { code: "CHANGELOG_MISSING" }
    );
  }

  const firstPublic = options.firstCanonicalPublicRelease === true;

  const preamble = [
    `# Atlas ${version}`,
    "",
    firstPublic
      ? [
          "`0.1.0` was a historical internal snapshot. No public `v0.1.0` tag or GitHub Release was published.",
          `**${version} is the first canonical public GitHub Release.** Atlas remains pre-1.0.`,
        ].join("\n")
      : `Atlas ${version} is a pre-1.0 repository/platform snapshot release.`,
    "",
    "## Changes",
    "",
    section,
    "",
    "## Release identity",
    "",
    `- Tag: \`${tagNameForVersion(version)}\``,
    options.commitSha ? `- Commit: \`${options.commitSha}\`` : null,
    "- Product: Atlas repository/platform snapshot (not independent npm packages)",
    options.sbomFileName
      ? `- SBOM: \`${options.sbomFileName}\` (SPDX 2.3 snapshot of \`pnpm-lock.yaml\`)`
      : null,
    "",
    "## Support and limitations",
    "",
    "- Supported line: current Atlas release on `main` after the latest intentional version merge.",
    "- No LTS programme at this stage.",
    "- Workspace packages remain `private` and are **not** published to npm.",
    "- This release does **not** include signed provenance, SLSA attestation, or a formal security audit.",
    "- Pre-1.0 APIs, templates, and upgrade mechanics may still evolve; breaking changes use a **minor** bump.",
    "",
    "License: Apache-2.0. See `LICENSE` and `docs/how-we-build/releases-and-governance.md`.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return `${preamble}\n`;
}

export function isFirstCanonicalPublicRelease({ existingTags = [], existingReleases = [] } = {}) {
  const publicTags = existingTags.filter(
    (entry) => ATLAS_TAG_PATTERN.test(entry.name) && entry.name !== tagNameForVersion("0.1.0")
  );
  return publicTags.length === 0 && existingReleases.length === 0;
}

export function readPublicationInputs(repoRoot = process.cwd()) {
  return {
    rootVersion: readRootVersion(repoRoot),
    workspaceVersions: readWorkspaceVersions(repoRoot),
    changelog: readFileSync(path.join(repoRoot, "CHANGELOG.md"), "utf8"),
    pendingChangesetFiles: listPendingChangesetFiles(repoRoot),
  };
}
