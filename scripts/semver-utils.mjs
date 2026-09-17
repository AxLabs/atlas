/**
 * SemVer helpers for Atlas repository releases.
 */

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;

export function parseSemver(version) {
  const match = version.match(SEMVER_PATTERN);
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
    build: match[5] ?? null,
  };
}

/** True when the version has a SemVer prerelease component (e.g. 0.2.0-rc.1). */
export function hasSemverPrerelease(version) {
  const parsed = parseSemver(version);
  return Boolean(parsed?.prerelease);
}

/** GitHub Release prerelease flag — only SemVer prerelease components, not 0.x.y itself. */
export function isGithubPrerelease(version) {
  return hasSemverPrerelease(version);
}

export function isPreOnePointZero(version) {
  const parsed = parseSemver(version);
  return parsed !== null && parsed.major === 0;
}

export function isStablePublicRelease(version) {
  const parsed = parseSemver(version);
  return parsed !== null && parsed.major >= 1;
}

export function assertValidAtlasReleaseVersion(version) {
  if (!parseSemver(version)) {
    throw new Error(`Invalid Atlas release version "${version}"`);
  }
}
