import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  AtlasBaselineCaptureError,
  AtlasContractError,
  captureRepositorySyncedPathChecksums,
  captureSyncedPathChecksums,
  captureSyncedPathChecksumsStrict,
  computeBaselineChecksum,
  getSyncedPathBaselineStatus,
  isValidBaselineChecksum,
  normalizeBaselineChecksum,
  parseAtlasProjectContract,
  validatePlatformBaselineIntegrity,
} from "../index";

function createTempRepo(structure: Record<string, string>): string {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-baseline-"));

  for (const [relativePath, contents] of Object.entries(structure)) {
    const absolutePath = path.join(tempRoot, relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, contents, "utf8");
  }

  return tempRoot;
}

const VALID_SHA256 = computeBaselineChecksum("baseline-content");

describe("baseline checksum format", () => {
  it("accepts valid SHA-256 checksums", () => {
    expect(isValidBaselineChecksum(VALID_SHA256)).toBe(true);
    expect(normalizeBaselineChecksum(VALID_SHA256)).toBe(VALID_SHA256);
  });

  it("normalizes uppercase hex to lowercase", () => {
    const uppercase = `sha256:${VALID_SHA256.slice("sha256:".length).toUpperCase()}`;
    expect(normalizeBaselineChecksum(uppercase)).toBe(VALID_SHA256);
  });

  it("rejects missing prefix", () => {
    expect(isValidBaselineChecksum(VALID_SHA256.slice("sha256:".length))).toBe(false);
  });

  it("rejects wrong hash length", () => {
    expect(isValidBaselineChecksum("sha256:abc")).toBe(false);
  });

  it("rejects non-hex characters", () => {
    expect(isValidBaselineChecksum(`sha256:${"g".repeat(64)}`)).toBe(false);
  });

  it("rejects empty hash", () => {
    expect(isValidBaselineChecksum("sha256:")).toBe(false);
  });
});

describe("captureSyncedPathChecksums", () => {
  it("reports missing synced paths without silently omitting them", () => {
    const tempRoot = createTempRepo({
      "apps/web/src/lib/api/client.ts": "client\n",
    });

    const result = captureSyncedPathChecksums({
      repoRoot: tempRoot,
      applicationRoot: "apps/web",
      syncedPaths: ["src/lib/api/client.ts", "src/lib/api/errors.ts"],
    });

    expect(result.isComplete).toBe(false);
    expect(result.missingPaths).toEqual(["src/lib/api/errors.ts"]);
    expect(result.checksums["src/lib/api/client.ts"]).toBeDefined();
    expect(result.checksums["src/lib/api/errors.ts"]).toBeUndefined();

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("throws in strict mode when synced paths are missing", () => {
    const tempRoot = createTempRepo({
      "apps/web/src/lib/api/client.ts": "client\n",
    });

    expect(() =>
      captureSyncedPathChecksumsStrict({
        repoRoot: tempRoot,
        applicationRoot: "apps/web",
        syncedPaths: ["src/lib/api/client.ts", "src/lib/api/errors.ts"],
      })
    ).toThrow(AtlasBaselineCaptureError);

    rmSync(tempRoot, { recursive: true, force: true });
  });
});

describe("getSyncedPathBaselineStatus", () => {
  const baselineChecksums = {
    "src/lib/auth/session.ts": computeBaselineChecksum("atlas-session"),
  };

  it("returns unchanged when checksums match", () => {
    expect(
      getSyncedPathBaselineStatus({
        relativePath: "src/lib/auth/session.ts",
        consumerApplicationRoot: "/tmp",
        baselineChecksums,
        consumerContent: "atlas-session",
      })
    ).toBe("unchanged");
  });

  it("returns modified when consumer diverged", () => {
    expect(
      getSyncedPathBaselineStatus({
        relativePath: "src/lib/auth/session.ts",
        consumerApplicationRoot: "/tmp",
        baselineChecksums,
        consumerContent: "consumer-session",
      })
    ).toBe("modified");
  });

  it("returns unknown when baseline checksum is missing", () => {
    expect(
      getSyncedPathBaselineStatus({
        relativePath: "src/lib/auth/session.ts",
        consumerApplicationRoot: "/tmp",
        baselineChecksums: {},
        consumerContent: "atlas-session",
      })
    ).toBe("unknown");
  });

  it("returns unknown when baseline checksum is malformed", () => {
    expect(
      getSyncedPathBaselineStatus({
        relativePath: "src/lib/auth/session.ts",
        consumerApplicationRoot: "/tmp",
        baselineChecksums: { "src/lib/auth/session.ts": "sha256:bad" },
        consumerContent: "atlas-session",
      })
    ).toBe("unknown");
  });

  it("returns unknown when consumer file is missing on disk", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-baseline-missing-"));

    expect(
      getSyncedPathBaselineStatus({
        relativePath: "src/lib/auth/session.ts",
        consumerApplicationRoot: tempRoot,
        baselineChecksums,
      })
    ).toBe("unknown");

    rmSync(tempRoot, { recursive: true, force: true });
  });
});

describe("validatePlatformBaselineIntegrity", () => {
  it("flags missing synced paths and malformed checksums", () => {
    const issues = validatePlatformBaselineIntegrity({
      baseline: {
        atlasVersion: "0.1.0",
        contractSchemaVersion: 1,
        templateManifestSchemaVersion: 2,
        syncedPathChecksums: {
          "src/lib/api/client.ts": "sha256:bad",
        },
      },
      expectedSyncedPaths: ["src/lib/api/client.ts", "src/lib/api/errors.ts"],
      currentManifestSchemaVersion: 1,
    });

    expect(issues.map((issue) => issue.kind)).toEqual(
      expect.arrayContaining([
        "manifest-schema-mismatch",
        "missing-synced-path",
        "invalid-checksum",
      ])
    );
  });
});

describe("platform.baseline schema validation", () => {
  it("rejects malformed checksum values", () => {
    expect(() =>
      parseAtlasProjectContract({
        schemaVersion: 1,
        platform: {
          baseline: {
            atlasVersion: "0.1.0",
            contractSchemaVersion: 1,
            templateManifestSchemaVersion: 1,
            syncedPathChecksums: {
              "src/lib/api/client.ts": "sha256:invalid",
            },
          },
        },
      })
    ).toThrow(AtlasContractError);
  });

  it("normalizes valid checksum values on parse", () => {
    const uppercase = `sha256:${VALID_SHA256.slice("sha256:".length).toUpperCase()}`;
    const parsed = parseAtlasProjectContract({
      schemaVersion: 1,
      platform: {
        baseline: {
          atlasVersion: "0.1.0",
          contractSchemaVersion: 1,
          templateManifestSchemaVersion: 1,
          syncedPathChecksums: {
            "src/lib/api/client.ts": uppercase,
          },
        },
      },
    });

    expect(parsed.platform?.baseline?.syncedPathChecksums["src/lib/api/client.ts"]).toBe(
      VALID_SHA256
    );
  });

  it("accepts optional repositorySyncedPathChecksums without requiring them", () => {
    const parsed = parseAtlasProjectContract({
      schemaVersion: 1,
      platform: {
        baseline: {
          atlasVersion: "1.2.0",
          contractSchemaVersion: 1,
          templateManifestSchemaVersion: 1,
          syncedPathChecksums: {
            "src/lib/api/client.ts": VALID_SHA256,
          },
        },
      },
    });

    expect(parsed.platform?.baseline?.repositorySyncedPathChecksums).toBeUndefined();
  });
});

describe("captureRepositorySyncedPathChecksums", () => {
  it("checksums repository files inside the repo root", () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), "atlas-repo-checksum-"));
    const repoRoot = path.join(parent, "repo");
    mkdirSync(repoRoot, { recursive: true });
    writeFileSync(path.join(repoRoot, "Dockerfile"), "FROM alpine\n");

    const result = captureRepositorySyncedPathChecksums({
      repoRoot,
      repositorySyncedPaths: ["Dockerfile"],
    });

    expect(result.isComplete).toBe(true);
    expect(result.checksums.Dockerfile).toBe(computeBaselineChecksum("FROM alpine\n"));

    rmSync(parent, { recursive: true, force: true });
  });

  it("does not checksum files outside the repository root", () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), "atlas-repo-checksum-escape-"));
    const repoRoot = path.join(parent, "repo");
    mkdirSync(repoRoot, { recursive: true });
    writeFileSync(path.join(repoRoot, "Dockerfile"), "FROM alpine\n");
    writeFileSync(path.join(parent, "outside"), "SECRET\n");

    for (const relativePath of [
      "../outside",
      "../../outside",
      "/tmp/outside",
      "C:\\outside",
      "..\\..\\outside",
      "foo/../../../outside",
      "foo\\..\\..\\outside",
    ]) {
      expect(() =>
        captureRepositorySyncedPathChecksums({
          repoRoot,
          repositorySyncedPaths: [relativePath],
        })
      ).toThrow();
    }

    expect(readFileSync(path.join(parent, "outside"), "utf8")).toBe("SECRET\n");

    rmSync(parent, { recursive: true, force: true });
  });
});
