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

function createDirectory(tempRoot: string, relativePath: string): void {
  const absolutePath = path.join(tempRoot, relativePath);
  mkdirSync(absolutePath, { recursive: true });
}

function createFile(tempRoot: string, relativePath: string, contents = ""): void {
  const absolutePath = path.join(tempRoot, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents, "utf8");
}

function createPackage(tempRoot: string, relativePath: string, packageName: string): void {
  createDirectory(tempRoot, relativePath);
  createFile(
    tempRoot,
    path.posix.join(relativePath, "package.json"),
    `${JSON.stringify({ name: packageName }, null, 2)}\n`
  );
}

function createMinimalValidRepoStructure(
  tempRoot: string,
  options: {
    includeReferenceSurfaces?: boolean;
    includeOpenApi?: boolean;
    uiPath?: string;
    uiPackage?: string;
  } = {}
): void {
  const {
    includeReferenceSurfaces = true,
    includeOpenApi = true,
    uiPath = DEFAULT_ATLAS_PROJECT_CONTRACT.ui.path,
    uiPackage = DEFAULT_ATLAS_PROJECT_CONTRACT.ui.package,
  } = options;

  createDirectory(tempRoot, DEFAULT_ATLAS_PROJECT_CONTRACT.application.root);
  createDirectory(tempRoot, DEFAULT_ATLAS_PROJECT_CONTRACT.features.product);

  if (includeReferenceSurfaces) {
    createDirectory(tempRoot, DEFAULT_ATLAS_PROJECT_CONTRACT.features.reference);
    createDirectory(tempRoot, DEFAULT_ATLAS_PROJECT_CONTRACT.features.examples);
    createDirectory(tempRoot, DEFAULT_ATLAS_PROJECT_CONTRACT.reference.components);
    createDirectory(tempRoot, DEFAULT_ATLAS_PROJECT_CONTRACT.reference.routes);
  }

  createPackage(tempRoot, uiPath, uiPackage);

  if (includeOpenApi) {
    createFile(tempRoot, DEFAULT_ATLAS_PROJECT_CONTRACT.generated.openApi.spec, "{}");
    createFile(tempRoot, DEFAULT_ATLAS_PROJECT_CONTRACT.generated.openApi.schema, "export {};\n");
  }
}

function createValidRepoStructure(tempRoot: string): void {
  createMinimalValidRepoStructure(tempRoot);
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

  it("resolves when reference surfaces are absent but conventional paths remain in output", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-contract-no-reference-"));
    createMinimalValidRepoStructure(tempRoot, { includeReferenceSurfaces: false });
    writeContract(tempRoot, { schemaVersion: 1 });

    try {
      const resolved = resolveAtlasProject(tempRoot);

      expect(resolved.features.reference).toBe(DEFAULT_ATLAS_PROJECT_CONTRACT.features.reference);
      expect(resolved.features.examples).toBe(DEFAULT_ATLAS_PROJECT_CONTRACT.features.examples);
      expect(resolved.reference.components).toBe(
        DEFAULT_ATLAS_PROJECT_CONTRACT.reference.components
      );
      expect(resolved.reference.routes).toBe(DEFAULT_ATLAS_PROJECT_CONTRACT.reference.routes);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("resolves when OpenAPI is disabled and generated files are absent", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-contract-no-openapi-"));
    createMinimalValidRepoStructure(tempRoot, { includeOpenApi: false });
    writeContract(tempRoot, {
      schemaVersion: 1,
      capabilities: {
        openApi: false,
      },
    });

    try {
      expect(() => resolveAtlasProject(tempRoot)).not.toThrow();
      const resolved = resolveAtlasProject(tempRoot);
      expect(resolved.capabilities.openApi).toBe(false);
      expect(resolved.generated.openApi.spec).toBe(
        DEFAULT_ATLAS_PROJECT_CONTRACT.generated.openApi.spec
      );
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("throws when OpenAPI is enabled and the spec file is missing", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-contract-openapi-missing-"));
    createMinimalValidRepoStructure(tempRoot, { includeOpenApi: false });
    writeContract(tempRoot, { schemaVersion: 1 });

    try {
      expect(() => resolveAtlasProject(tempRoot)).toThrow(AtlasContractError);
      try {
        resolveAtlasProject(tempRoot);
      } catch (error) {
        expect((error as AtlasContractError).code).toBe(
          AtlasContractErrorCode.CONTRACT_STRUCTURE_INVALID
        );
        expect((error as AtlasContractError).message).toContain("generated.openApi.spec");
      }
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("throws when an OpenAPI path is a directory instead of a file", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-contract-openapi-dir-"));
    createMinimalValidRepoStructure(tempRoot, { includeOpenApi: false });
    createDirectory(tempRoot, DEFAULT_ATLAS_PROJECT_CONTRACT.generated.openApi.spec);
    createFile(tempRoot, DEFAULT_ATLAS_PROJECT_CONTRACT.generated.openApi.schema, "export {};\n");
    writeContract(tempRoot, { schemaVersion: 1 });

    try {
      expect(() => resolveAtlasProject(tempRoot)).toThrow(AtlasContractError);
      try {
        resolveAtlasProject(tempRoot);
      } catch (error) {
        expect((error as AtlasContractError).code).toBe(
          AtlasContractErrorCode.CONTRACT_STRUCTURE_INVALID
        );
        expect((error as AtlasContractError).message).toContain(
          "Expected generated.openApi.spec to be a file"
        );
      }
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("throws when application.root is a file instead of a directory", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-contract-app-file-"));
    createFile(tempRoot, DEFAULT_ATLAS_PROJECT_CONTRACT.application.root, "not-a-directory");
    createDirectory(tempRoot, "apps/features-only");
    createPackage(tempRoot, DEFAULT_ATLAS_PROJECT_CONTRACT.ui.path, "@atlas/ui");
    writeContract(tempRoot, {
      schemaVersion: 1,
      features: {
        product: "apps/features-only",
      },
      capabilities: {
        openApi: false,
      },
    });

    try {
      expect(() => resolveAtlasProject(tempRoot)).toThrow(AtlasContractError);
      try {
        resolveAtlasProject(tempRoot);
      } catch (error) {
        expect((error as AtlasContractError).code).toBe(
          AtlasContractErrorCode.CONTRACT_STRUCTURE_INVALID
        );
        expect((error as AtlasContractError).message).toContain(
          "Expected application.root to be a directory"
        );
      }
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("resolves when ui.package matches ui.path/package.json", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-contract-ui-match-"));
    createMinimalValidRepoStructure(tempRoot, {
      uiPath: "packages/ui",
      uiPackage: "@atlas/ui",
    });
    writeContract(tempRoot, { schemaVersion: 1 });

    try {
      expect(() => resolveAtlasProject(tempRoot)).not.toThrow();
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("throws when ui.package does not match ui.path/package.json", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-contract-ui-mismatch-"));
    createMinimalValidRepoStructure(tempRoot, {
      uiPath: "packages/config",
      uiPackage: "@atlas/config",
    });
    writeContract(tempRoot, {
      schemaVersion: 1,
      ui: {
        package: "@atlas/ui",
        path: "packages/config",
      },
    });

    try {
      expect(() => resolveAtlasProject(tempRoot)).toThrow(AtlasContractError);
      try {
        resolveAtlasProject(tempRoot);
      } catch (error) {
        expect((error as AtlasContractError).code).toBe(
          AtlasContractErrorCode.CONTRACT_STRUCTURE_INVALID
        );
        expect((error as AtlasContractError).message).toContain(
          "Atlas contract UI package mismatch"
        );
        expect((error as AtlasContractError).message).toContain("@atlas/ui");
        expect((error as AtlasContractError).message).toContain("@atlas/config");
      }
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("throws AtlasContractError for missing ui.path/package.json", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-contract-ui-no-pkg-"));
    createDirectory(tempRoot, DEFAULT_ATLAS_PROJECT_CONTRACT.application.root);
    createDirectory(tempRoot, DEFAULT_ATLAS_PROJECT_CONTRACT.features.product);
    createDirectory(tempRoot, DEFAULT_ATLAS_PROJECT_CONTRACT.ui.path);
    createFile(tempRoot, DEFAULT_ATLAS_PROJECT_CONTRACT.generated.openApi.spec, "{}");
    createFile(tempRoot, DEFAULT_ATLAS_PROJECT_CONTRACT.generated.openApi.schema, "export {};\n");
    writeContract(tempRoot, { schemaVersion: 1 });

    try {
      expect(() => resolveAtlasProject(tempRoot)).toThrow(AtlasContractError);
      try {
        resolveAtlasProject(tempRoot);
      } catch (error) {
        expect((error as AtlasContractError).code).toBe(
          AtlasContractErrorCode.CONTRACT_STRUCTURE_INVALID
        );
        expect((error as AtlasContractError).message).toContain("ui.path/package.json");
      }
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("throws AtlasContractError for malformed ui.path/package.json", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-contract-ui-bad-json-"));
    createMinimalValidRepoStructure(tempRoot, { includeOpenApi: true });
    createFile(
      tempRoot,
      path.posix.join(DEFAULT_ATLAS_PROJECT_CONTRACT.ui.path, "package.json"),
      "{ not-json"
    );
    writeContract(tempRoot, { schemaVersion: 1 });

    try {
      expect(() => resolveAtlasProject(tempRoot)).toThrow(AtlasContractError);
      try {
        resolveAtlasProject(tempRoot);
      } catch (error) {
        expect((error as AtlasContractError).code).toBe(
          AtlasContractErrorCode.CONTRACT_STRUCTURE_INVALID
        );
        expect((error as AtlasContractError).message).toContain("invalid JSON");
        expect((error as AtlasContractError).message).not.toContain("JSON.parse");
      }
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("throws AtlasContractError when ui.path/package.json is missing a name field", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-contract-ui-no-name-"));
    createMinimalValidRepoStructure(tempRoot, { includeOpenApi: true });
    createFile(
      tempRoot,
      path.posix.join(DEFAULT_ATLAS_PROJECT_CONTRACT.ui.path, "package.json"),
      JSON.stringify({ version: "0.0.0" })
    );
    writeContract(tempRoot, { schemaVersion: 1 });

    try {
      expect(() => resolveAtlasProject(tempRoot)).toThrow(AtlasContractError);
      try {
        resolveAtlasProject(tempRoot);
      } catch (error) {
        expect((error as AtlasContractError).code).toBe(
          AtlasContractErrorCode.CONTRACT_STRUCTURE_INVALID
        );
        expect((error as AtlasContractError).message).toContain("missing a package name");
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
