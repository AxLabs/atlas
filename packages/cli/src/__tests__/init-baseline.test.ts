import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { ATLAS_CONTRACT_FILENAME, resolveAtlasProject } from "@atlas/project";

import { runInit } from "../commands/init";
import { CliError, CliErrorCode } from "../errors/cli-error";
import { ExitCode } from "../exit-codes";
import { createMinimalAtlasFixture } from "./helpers/fixture";
import { runAtlasCli } from "./helpers/run-cli";

const MINIMAL_MANIFEST = {
  schemaVersion: 1,
  canonicalApplication: "apps/web",
  consumerApplications: ["apps/reference"],
  syncedPaths: ["src/lib/api/client.ts"],
  generatedPaths: [],
  independentPaths: {},
  referenceOnlyPaths: [],
  starterOnlyPaths: [],
};

function writeInfrastructureManifest(
  repoRoot: string,
  manifest: unknown,
  syncedFiles?: Record<string, string>
): void {
  mkdirSync(path.join(repoRoot, "templates"), { recursive: true });
  writeFileSync(
    path.join(repoRoot, "templates/app-infrastructure.manifest.json"),
    typeof manifest === "string" ? manifest : `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );

  if (syncedFiles) {
    for (const [relativePath, content] of Object.entries(syncedFiles)) {
      const absolutePath = path.join(repoRoot, "apps/web", relativePath);
      mkdirSync(path.dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, content, "utf8");
    }
  }
}

describe("atlas init baseline capture", () => {
  it("succeeds without platform.baseline when the infrastructure manifest is absent", () => {
    const fixture = createMinimalAtlasFixture();
    const contractPath = path.join(fixture.root, ATLAS_CONTRACT_FILENAME);

    const result = runInit({ cwd: fixture.root, reference: "keep", env: "skip" });

    expect(result.alreadyInitialized).toBe(false);
    expect(existsSync(contractPath)).toBe(true);
    const contract = JSON.parse(readFileSync(contractPath, "utf8")) as {
      platform?: { baseline?: unknown };
    };
    expect(contract.platform?.baseline).toBeUndefined();
    expect(() => resolveAtlasProject(fixture.root)).not.toThrow();
  });

  it("records complete platform.baseline when the manifest and synced paths are healthy", () => {
    const fixture = createMinimalAtlasFixture();
    writeInfrastructureManifest(fixture.root, MINIMAL_MANIFEST, {
      "src/lib/api/client.ts": "export const api = true;\n",
    });

    const result = runInit({ cwd: fixture.root, reference: "keep", env: "skip" });

    expect(result.alreadyInitialized).toBe(false);
    const contract = JSON.parse(
      readFileSync(path.join(fixture.root, ATLAS_CONTRACT_FILENAME), "utf8")
    ) as {
      platform?: {
        baseline?: {
          atlasVersion: string;
          contractSchemaVersion: number;
          templateManifestSchemaVersion: number;
          syncedPathChecksums: Record<string, string>;
        };
      };
    };

    const baseline = contract.platform?.baseline;
    expect(baseline).toBeDefined();
    expect(baseline?.atlasVersion).toBe("0.1.0");
    expect(baseline?.contractSchemaVersion).toBe(1);
    expect(baseline?.templateManifestSchemaVersion).toBe(1);
    expect(Object.keys(baseline?.syncedPathChecksums ?? {})).toEqual(["src/lib/api/client.ts"]);
    expect(baseline?.syncedPathChecksums["src/lib/api/client.ts"]).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(() => resolveAtlasProject(fixture.root)).not.toThrow();
  });

  it("fails before writing atlas.config.json when a manifest synced path is missing", () => {
    const fixture = createMinimalAtlasFixture();
    writeInfrastructureManifest(
      fixture.root,
      {
        ...MINIMAL_MANIFEST,
        syncedPaths: ["src/lib/api/client.ts", "src/lib/api/errors.ts"],
      },
      {
        "src/lib/api/client.ts": "export const api = true;\n",
      }
    );

    expect(() => runInit({ cwd: fixture.root, reference: "keep", env: "skip" })).toThrow(CliError);

    try {
      runInit({ cwd: fixture.root, reference: "keep", env: "skip" });
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.code).toBe(CliErrorCode.PREREQUISITE_ERROR);
      expect(cliError.message).toContain("Baseline capture is incomplete");
      expect(cliError.message).toContain("src/lib/api/errors.ts");
    }

    expect(existsSync(path.join(fixture.root, ATLAS_CONTRACT_FILENAME))).toBe(false);
  });

  it("fails with an actionable error when the infrastructure manifest is invalid", () => {
    const fixture = createMinimalAtlasFixture();
    writeInfrastructureManifest(fixture.root, "{ invalid json");

    expect(() => runInit({ cwd: fixture.root, reference: "keep", env: "skip" })).toThrow(CliError);

    try {
      runInit({ cwd: fixture.root, reference: "keep", env: "skip" });
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.code).toBe(CliErrorCode.USAGE_ERROR);
      expect(cliError.message).toContain("invalid JSON");
    }

    expect(existsSync(path.join(fixture.root, ATLAS_CONTRACT_FILENAME))).toBe(false);
  });

  it("fails when checkout Atlas version cannot be resolved for baseline recording", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-init-version-"));
    mkdirSync(path.join(tempRoot, "apps/web"), { recursive: true });
    mkdirSync(path.join(tempRoot, "packages/ui"), { recursive: true });
    writeFileSync(path.join(tempRoot, "package.json"), "{}\n", "utf8");
    writeFileSync(
      path.join(tempRoot, "packages/ui/package.json"),
      `${JSON.stringify({ name: "@atlas/ui", version: "0.1.0", private: true }, null, 2)}\n`,
      "utf8"
    );
    writeInfrastructureManifest(tempRoot, MINIMAL_MANIFEST, {
      "src/lib/api/client.ts": "export const api = true;\n",
    });

    expect(() => runInit({ cwd: tempRoot, reference: "keep", env: "skip" })).toThrow(CliError);

    try {
      runInit({ cwd: tempRoot, reference: "keep", env: "skip" });
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.code).toBe(CliErrorCode.PREREQUISITE_ERROR);
      expect(cliError.message).toContain("Missing version");
    }

    expect(existsSync(path.join(tempRoot, ATLAS_CONTRACT_FILENAME))).toBe(false);
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("surfaces baseline capture failures through the CLI executable", () => {
    const fixture = createMinimalAtlasFixture();
    writeInfrastructureManifest(fixture.root, MINIMAL_MANIFEST);

    const result = runAtlasCli(["init", "--cwd", fixture.root], fixture.root);

    expect(result.exitCode).toBe(ExitCode.PREREQUISITE_ERROR);
    expect(result.stderr).toContain("Baseline capture is incomplete");
    expect(existsSync(path.join(fixture.root, ATLAS_CONTRACT_FILENAME))).toBe(false);
  });
});
