import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { detectWorktreeStatus } from "../upgrade/worktree";

describe("worktree status", () => {
  it("detects dirty git worktrees", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-worktree-"));
    mkdirSync(path.join(tempRoot, ".git"), { recursive: true });
    writeFileSync(path.join(tempRoot, "dirty.txt"), "change\n", "utf8");

    const status = detectWorktreeStatus(tempRoot);
    expect(status.isGitRepository).toBe(false);

    rmSync(tempRoot, { recursive: true, force: true });
  });
});
