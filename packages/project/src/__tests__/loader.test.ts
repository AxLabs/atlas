import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  AtlasContractError,
  AtlasContractErrorCode,
  DEFAULT_ATLAS_PROJECT_CONTRACT,
  loadAtlasProject,
  normalizeRepoRelativePath,
  parseAtlasProjectContract,
  resolveAtlasProject,
  resolveAtlasProjectContract,
  serializeResolvedAtlasProject,
  toResolvedAtlasProjectJson,
} from "../index";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

function createTempRepo(structure: Record<string, string | null>): string {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-contract-"));

  for (const [relativePath, contents] of Object.entries(structure)) {
    const absolutePath = path.join(tempRoot, relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });

    if (contents !== null) {
      writeFileSync(absolutePath, contents, "utf8");
    }
  }

  return tempRoot;
}

function writeContract(tempRoot: string, contract: unknown): void {
  writeFileSync(path.join(tempRoot, "atlas.config.json"), JSON.stringify(contract, null, 2));
}

function createValidRepoStructure(tempRoot: string): void {
  for (const relativePath of [
    DEFAULT_ATLAS_PROJECT_CONTRACT.application.root,
    DEFAULT_ATLAS_PROJECT_CONTRACT.features.product,
    DEFAULT_ATLAS_PROJECT_CONTRACT.features.reference,
    DEFAULT_ATLAS_PROJECT_CONTRACT.features.examples,
    DEFAULT_ATLAS_PROJECT_CONTRACT.reference.components,
    DEFAULT_ATLAS_PROJECT_CONTRACT.reference.routes,
    DEFAULT_ATLAS_PROJECT_CONTRACT.ui.path,
    DEFAULT_ATLAS_PROJECT_CONTRACT.generated.openApi.spec,
    DEFAULT_ATLAS_PROJECT_CONTRACT.generated.openApi.schema,
  ]) {
    const absolutePath = path.join(tempRoot, relativePath);
    mkdirSync(absolutePath, { recursive: true });
    writeFileSync(path.join(absolutePath, ".keep"), "", "utf8");
  }
}

describe("parseAtlasProjectContract", () => {
  it("accepts a valid complete contract", () => {
    const parsed = parseAtlasProjectContract({
      schemaVersion: 1,
      application: { root: "apps/web" },
      features: {
        product: "apps/web/src/features",
        reference: "apps/web/src/features/reference",
        examples: "apps/web/src/features/examples",
      },
      reference: {
        components: "apps/web/src/components/reference",
        routes: "apps/web/src/app/examples",
      },
      ui: {
        package: "@atlas/ui",
        path: "packages/ui",
        sourceImports: false,
      },
      generated: {
        openApi: {
          spec: "openapi/openapi.json",
          schema: "apps/web/src/lib/api/contracts/schema.ts",
        },
      },
      capabilities: {
        auth: true,
        consent: false,
        analytics: false,
        featureFlags: true,
        i18n: true,
        openApi: true,
        observability: true,
      },
      boundaries: {
        noFeatureToFeatureImports: true,
        noProductImportsFromReference: true,
        uiPublicApiOnly: true,
      },
    });

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.capabilities?.consent).toBe(false);
  });

  it("accepts a valid minimal contract with only schemaVersion", () => {
    const parsed = parseAtlasProjectContract({ schemaVersion: 1 });
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.application).toBeUndefined();
  });

  it("rejects unknown fields", () => {
    expect(() =>
      parseAtlasProjectContract({
        schemaVersion: 1,
        capabilties: {},
      })
    ).toThrow(AtlasContractError);

    try {
      parseAtlasProjectContract({
        schemaVersion: 1,
        capabilties: {},
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AtlasContractError);
      expect((error as AtlasContractError).code).toBe(
        AtlasContractErrorCode.CONTRACT_VALIDATION_FAILED
      );
      expect((error as AtlasContractError).message).toContain("capabilties");
    }
  });

  it("rejects unsupported contract versions clearly", () => {
    expect(() => parseAtlasProjectContract({ schemaVersion: 2 })).toThrow(AtlasContractError);

    try {
      parseAtlasProjectContract({ schemaVersion: 2 });
    } catch (error) {
      expect(error).toBeInstanceOf(AtlasContractError);
      expect((error as AtlasContractError).code).toBe(
        AtlasContractErrorCode.CONTRACT_UNSUPPORTED_VERSION
      );
      expect((error as AtlasContractError).message).toContain(
        "Unsupported Atlas contract schema version 2"
      );
    }
  });

  it("rejects structurally invalid path values", () => {
    expect(() =>
      parseAtlasProjectContract({
        schemaVersion: 1,
        application: { root: "/absolute/path" },
      })
    ).toThrow(AtlasContractError);
  });
});

describe("resolveAtlasProjectContract", () => {
  it("applies deterministic defaults for a minimal contract", () => {
    const resolved = resolveAtlasProjectContract({ schemaVersion: 1 });

    expect(resolved).toEqual({
      schemaVersion: 1,
      ...DEFAULT_ATLAS_PROJECT_CONTRACT,
    });
  });

  it("merges optional capability overrides", () => {
    const resolved = resolveAtlasProjectContract({
      schemaVersion: 1,
      capabilities: {
        analytics: false,
        consent: false,
      },
    });

    expect(resolved.capabilities.analytics).toBe(false);
    expect(resolved.capabilities.consent).toBe(false);
    expect(resolved.capabilities.auth).toBe(true);
  });
});

describe("resolveAtlasProject", () => {
  it("loads and resolves the canonical repository contract", () => {
    const resolved = resolveAtlasProject(REPO_ROOT);
    expect(resolved.application.root).toBe("apps/web");
    expect(resolved.features.product).toBe("apps/web/src/features");
  });

  it("throws when the contract file is missing", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-contract-missing-"));

    try {
      expect(() => resolveAtlasProject(tempRoot)).toThrow(AtlasContractError);
      try {
        resolveAtlasProject(tempRoot);
      } catch (error) {
        expect((error as AtlasContractError).code).toBe(AtlasContractErrorCode.CONTRACT_NOT_FOUND);
      }
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("throws for malformed JSON", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-contract-json-"));
    writeFileSync(path.join(tempRoot, "atlas.config.json"), "{ not-json", "utf8");

    try {
      expect(() => loadAtlasProject(tempRoot)).toThrow(AtlasContractError);
      try {
        loadAtlasProject(tempRoot);
      } catch (error) {
        expect((error as AtlasContractError).code).toBe(
          AtlasContractErrorCode.CONTRACT_INVALID_JSON
        );
      }
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("throws when declared paths do not exist", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-contract-structure-"));
    writeContract(tempRoot, {
      schemaVersion: 1,
      application: { root: "missing/app" },
    });

    try {
      expect(() => resolveAtlasProject(tempRoot)).toThrow(AtlasContractError);
      try {
        resolveAtlasProject(tempRoot);
      } catch (error) {
        expect((error as AtlasContractError).code).toBe(
          AtlasContractErrorCode.CONTRACT_STRUCTURE_INVALID
        );
        expect((error as AtlasContractError).message).toContain("application.root");
      }
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

describe("serializeResolvedAtlasProject", () => {
  it("produces deterministic repository-relative JSON without undefined values", () => {
    const tempRoot = createTempRepo({});
    createValidRepoStructure(tempRoot);
    writeContract(tempRoot, { schemaVersion: 1 });

    const first = serializeResolvedAtlasProject(resolveAtlasProject(tempRoot));
    const second = serializeResolvedAtlasProject(resolveAtlasProject(tempRoot));

    expect(first).toBe(second);
    expect(first).not.toContain("undefined");
    expect(first).not.toContain(tempRoot);

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("normalizes path separators and trailing slashes", () => {
    const resolved = resolveAtlasProjectContract({
      schemaVersion: 1,
      application: { root: "./apps/web/" },
      features: {
        product: "apps/web/src/features/",
      },
    });

    expect(resolved.application.root).toBe("apps/web");
    expect(resolved.features.product).toBe("apps/web/src/features");
  });

  it("round-trips through JSON serialization", () => {
    const resolved = resolveAtlasProjectContract({ schemaVersion: 1 });
    const roundTripped = toResolvedAtlasProjectJson(resolved);
    expect(roundTripped).toEqual(resolved);
  });
});

describe("normalizeRepoRelativePath", () => {
  it("rejects absolute paths", () => {
    expect(() => normalizeRepoRelativePath("/Users/daniel/Projects/atlas/apps/web")).toThrow(
      "repository-relative"
    );
  });
});

describe("repository atlas.config.json", () => {
  it("matches the checked-in contract file", () => {
    const raw = loadAtlasProject(REPO_ROOT);
    expect(raw).toEqual({ schemaVersion: 1 });
  });

  it("can be resolved against the real repository layout", () => {
    const resolved = resolveAtlasProject(REPO_ROOT);
    expect(readFileSync(path.join(REPO_ROOT, "atlas.config.json"), "utf8")).toContain(
      '"schemaVersion": 1'
    );
    expect(resolved.ui.package).toBe("@atlas/ui");
  });
});
