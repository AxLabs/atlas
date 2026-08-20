import path from "node:path";

/** Normalize repository-relative paths to stable POSIX form without trailing slashes. */
export function normalizeRepoRelativePath(value: string): string {
  const normalized = value
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/\/+$/, "");
  if (normalized.length === 0) {
    return ".";
  }

  if (path.posix.isAbsolute(normalized)) {
    throw new Error(`Expected a repository-relative path, received absolute path: ${value}`);
  }

  if (normalized.includes("..")) {
    throw new Error(`Path must not contain parent segments: ${value}`);
  }

  return normalized;
}

export function joinRepoPath(repoRoot: string, relativePath: string): string {
  return path.join(repoRoot, normalizeRepoRelativePath(relativePath));
}
