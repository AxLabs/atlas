import path from "node:path";

function toPosixSeparators(value: string): string {
  return value.includes("\\") ? value.replaceAll("\\", "/") : value;
}

function stripLeadingDotSlash(value: string): string {
  let result = value;
  while (result.startsWith("./")) {
    result = result.slice(2);
  }
  return result;
}

function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) {
    end -= 1;
  }
  return end === value.length ? value : value.slice(0, end);
}

function isWindowsDrivePath(value: string): boolean {
  if (value.length < 2) {
    return false;
  }

  const drive = value.charCodeAt(0);
  const isLetter = (drive >= 65 && drive <= 90) || (drive >= 97 && drive <= 122);
  return isLetter && value.charCodeAt(1) === 58;
}

function isAbsoluteRepoPath(value: string, posix: string): boolean {
  return (
    path.posix.isAbsolute(posix) ||
    posix.startsWith("/") ||
    value.startsWith("\\") ||
    isWindowsDrivePath(value) ||
    isWindowsDrivePath(posix)
  );
}

/** Normalize repository-relative paths to stable POSIX form without trailing slashes. */
export function normalizeRepoRelativePath(value: string): string {
  if (typeof value !== "string") {
    throw new Error(`Expected a repository-relative path, received ${typeof value}`);
  }

  if (value.includes("\0")) {
    throw new Error(`Path must not contain a null byte: ${value}`);
  }

  const posix = toPosixSeparators(value);
  if (isAbsoluteRepoPath(value, posix)) {
    throw new Error(`Expected a repository-relative path, received absolute path: ${value}`);
  }

  const trimmed = stripTrailingSlashes(stripLeadingDotSlash(posix));
  if (trimmed.length === 0) {
    return ".";
  }

  const segments = trimmed.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw new Error(`Path must not contain parent segments: ${value}`);
  }

  return trimmed;
}

function assertContainedWithinRoot(
  resolvedRoot: string,
  resolvedPath: string,
  relativePath: string
): void {
  if (resolvedPath === resolvedRoot || resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
    return;
  }

  throw new Error(`Path resolves outside the repository root: ${relativePath}`);
}

/**
 * Join a repository-relative path onto a root and return the resolved path only
 * after proving it remains inside that root.
 */
export function joinRepoPath(repoRoot: string, relativePath: string): string {
  const normalized = normalizeRepoRelativePath(relativePath);
  const resolvedRoot = path.resolve(repoRoot);
  const resolved =
    normalized === "." ? resolvedRoot : path.resolve(resolvedRoot, ...normalized.split("/"));

  assertContainedWithinRoot(resolvedRoot, resolved, relativePath);
  return resolved;
}
