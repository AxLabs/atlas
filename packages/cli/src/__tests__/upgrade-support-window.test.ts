import { readFileSync } from "node:fs";
import path from "node:path";

import {
  buildProductionReleaseCatalog,
  isRehearsalOnlyAtlasVersion,
  selectSupportedReleaseWindow,
} from "../upgrade/release-catalog";
import { REHEARSAL_ONLY_ATLAS_VERSIONS } from "../upgrade/release-constants";
import { listProductionSnapshotVersions } from "../upgrade/release-assets";

const PACKAGE_ROOT = path.resolve(__dirname, "../..");

describe("production upgrade support window", () => {
  it("selects current plus immediately previous production snapshot", () => {
    expect(selectSupportedReleaseWindow("0.5.0", ["0.4.0", "0.5.0", "0.3.0"])).toEqual([
      "0.4.0",
      "0.5.0",
    ]);
    expect(selectSupportedReleaseWindow("0.4.0", ["0.4.0"])).toEqual(["0.4.0"]);
  });

  it("never treats rehearsal 0.1.0/0.2.0 as production support", () => {
    expect(REHEARSAL_ONLY_ATLAS_VERSIONS).toEqual(["0.1.0", "0.2.0"]);
    expect(isRehearsalOnlyAtlasVersion("0.1.0")).toBe(true);
    expect(isRehearsalOnlyAtlasVersion("0.2.0")).toBe(true);
    expect(isRehearsalOnlyAtlasVersion("0.4.0")).toBe(false);

    const catalog = buildProductionReleaseCatalog({
      currentVersion: "0.4.0",
      availableVersions: ["0.1.0", "0.2.0", "0.4.0"],
    });
    expect(catalog.supportedVersions).toEqual(["0.4.0"]);
    expect(catalog.rehearsalOnlyVersions).toEqual(["0.1.0", "0.2.0"]);
  });

  it("packages only the committed production snapshots in the support window", () => {
    const available = listProductionSnapshotVersions(
      path.join(PACKAGE_ROOT, "release-assets", "production")
    );
    expect(available).toContain("0.4.0");
    expect(available).not.toContain("0.1.0");
    expect(available).not.toContain("0.2.0");

    const currentVersion = (
      JSON.parse(readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8")) as {
        version: string;
      }
    ).version;
    const supportedVersions = selectSupportedReleaseWindow(currentVersion, available);
    expect(supportedVersions.at(-1)).toBe(currentVersion);
    expect(supportedVersions.length).toBeLessThanOrEqual(2);
    expect(supportedVersions.every((version) => !isRehearsalOnlyAtlasVersion(version))).toBe(true);
  });

  it("keeps the canonical 0.4.0 snapshot as a v0.4.0 baseline, not a current-main rewrite", () => {
    const snapshot = JSON.parse(
      readFileSync(
        path.join(PACKAGE_ROOT, "release-assets", "production", "0.4.0", "release.snapshot.json"),
        "utf8"
      )
    ) as {
      atlasVersion: string;
      packageVersions: Record<string, string>;
    };
    expect(snapshot.atlasVersion).toBe("0.4.0");
    expect(snapshot.packageVersions["@atlas/cli"]).toBe("0.4.0");
    expect(snapshot.packageVersions["@blitzcraftlabs/atlas"]).toBeUndefined();
  });
});
