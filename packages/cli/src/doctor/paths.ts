import path from "node:path";

export function toPosixRepoRelativePath(repoRoot: string, absolutePath: string): string {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

export function joinRepoAbsolutePath(repoRoot: string, relativePath: string): string {
  return path.join(repoRoot, ...relativePath.split("/"));
}
