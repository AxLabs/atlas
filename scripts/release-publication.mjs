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

export const REQUIRED_RELEASE_CHECK_WORKFLOWS = Object.freeze(["CI", "Security Audit"]);

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
 *   existingReleases?: Array<{ tagName: string, sha?: string | null }>,
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

  if (isHistoricalUnpublishedVersion(rootVersion)) {
    return {
      action: "noop",
      version: rootVersion,
      tag,
      prerelease: isGithubPrerelease(rootVersion),
      reason: `${rootVersion} is a historical internal snapshot and must not receive a public tag or GitHub Release`,
    };
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

  if (existingTag && existingRelease) {
    return {
      action: "noop",
      version: rootVersion,
      tag,
      prerelease: isGithubPrerelease(rootVersion),
      reason: `Tag ${tag} and GitHub Release already exist for this version`,
    };
  }

  if (!existingTag && existingRelease) {
    throw new PublicationError(`GitHub Release ${tag} exists without a matching git tag`, {
      code: "RELEASE_WITHOUT_TAG",
    });
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
