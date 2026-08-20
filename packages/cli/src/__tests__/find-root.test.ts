import path from "node:path";

import { findAtlasRepoRoot, findStructuralAtlasRoot } from "../project/find-root";
import { getRepoRoot } from "./helpers/run-cli";

describe("project root discovery", () => {
  const repoRoot = getRepoRoot();

  it("finds atlas.config.json from nested directories", () => {
    const nested = path.join(repoRoot, "packages/project/src");
    expect(findAtlasRepoRoot(nested)).toBe(repoRoot);
  });

  it("finds structural Atlas layout without a contract file", () => {
    const nested = path.join(repoRoot, "apps/web");
    expect(findStructuralAtlasRoot(nested)).toBe(repoRoot);
  });
});
