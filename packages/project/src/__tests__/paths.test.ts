import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { joinRepoPath, normalizeRepoRelativePath } from "../paths";

const ESCAPE_PATHS = [
  "../outside",
  "../../outside",
  "/tmp/outside",
  "C:\\outside",
  "..\\..\\outside",
  "foo/../../../outside",
  "foo\\..\\..\\outside",
  "foo/..\\../outside",
];

describe("normalizeRepoRelativePath", () => {
  it("normalizes separators, leading ./, and trailing slashes", () => {
    expect(normalizeRepoRelativePath("./apps/web/")).toBe("apps/web");
    expect(normalizeRepoRelativePath("apps\\web")).toBe("apps/web");
    expect(normalizeRepoRelativePath(".dockerignore")).toBe(".dockerignore");
    expect(normalizeRepoRelativePath("Dockerfile")).toBe("Dockerfile");
  });

  it("rejects absolute POSIX and Windows paths", () => {
    expect(() => normalizeRepoRelativePath("/tmp/outside")).toThrow("absolute path");
    expect(() => normalizeRepoRelativePath("C:\\outside")).toThrow("absolute path");
    expect(() => normalizeRepoRelativePath("C:/outside")).toThrow("absolute path");
  });

  it("rejects parent segments and mixed-separator traversal", () => {
    for (const relativePath of [
      "../outside",
      "../../outside",
      "..\\..\\outside",
      "foo/../../../outside",
      "foo\\..\\..\\outside",
      "foo/..\\../outside",
    ]) {
      expect(() => normalizeRepoRelativePath(relativePath)).toThrow("parent segments");
    }
  });

  it("rejects long slash sequences without quadratic regex matching", () => {
    const attack = `foo${"/".repeat(20_000)}x`;
    const started = process.hrtime.bigint();
    expect(() => normalizeRepoRelativePath(attack)).toThrow("parent segments");
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    expect(elapsedMs).toBeLessThan(250);
  });
});

describe("joinRepoPath", () => {
  it("returns a resolved path that stays inside the repository root", () => {
    const repoRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-join-repo-"));
    mkdirSync(path.join(repoRoot, "apps/web"), { recursive: true });
    writeFileSync(path.join(repoRoot, "Dockerfile"), "FROM alpine\n");

    const resolvedRoot = path.resolve(repoRoot);
    const joined = joinRepoPath(repoRoot, "Dockerfile");
    const nested = joinRepoPath(repoRoot, "apps/web");

    expect(joined).toBe(path.join(resolvedRoot, "Dockerfile"));
    expect(nested).toBe(path.join(resolvedRoot, "apps/web"));
    expect(joined.startsWith(`${resolvedRoot}${path.sep}`)).toBe(true);

    rmSync(repoRoot, { recursive: true, force: true });
  });

  it("rejects paths that would escape the repository root", () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), "atlas-join-parent-"));
    const repoRoot = path.join(parent, "repo");
    mkdirSync(repoRoot, { recursive: true });

    for (const relativePath of ESCAPE_PATHS) {
      expect(() => joinRepoPath(repoRoot, relativePath)).toThrow();
    }

    rmSync(parent, { recursive: true, force: true });
  });
});
