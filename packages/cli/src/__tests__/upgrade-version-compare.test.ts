import {
  compareAtlasVersions,
  isAtlasVersionGreaterThan,
  isAtlasVersionLessThan,
} from "../upgrade/version-compare";

describe("version compare", () => {
  it("orders Atlas SemVer strings", () => {
    expect(compareAtlasVersions("0.1.0", "0.2.0")).toBe(-1);
    expect(compareAtlasVersions("0.2.0", "0.2.0")).toBe(0);
    expect(compareAtlasVersions("0.3.0", "0.2.0")).toBe(1);
    expect(isAtlasVersionLessThan("0.1.0", "0.2.0")).toBe(true);
    expect(isAtlasVersionGreaterThan("0.2.0", "0.1.0")).toBe(true);
  });
});
