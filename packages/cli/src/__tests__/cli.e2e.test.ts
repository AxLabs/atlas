import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { ExitCode } from "../exit-codes";
import { CliErrorCode } from "../errors/cli-error";
import { resolveAtlasProject } from "@atlas/project";

import { createMinimalAtlasFixture, snapshotFixturePaths } from "./helpers/fixture";
import { getRepoRoot, runAtlasCli } from "./helpers/run-cli";
import { readCliAtlasVersion } from "../version";

function writeMinimalAtlasRepo(tempRoot: string): void {
  writeFileSync(
    path.join(tempRoot, "package.json"),
    `${JSON.stringify({ name: "@atlas/monorepo", version: "0.1.0", private: true }, null, 2)}\n`
  );
  writeFileSync(
    path.join(tempRoot, "atlas.config.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        features: {
          reference: "apps/reference/src/features",
          examples: "apps/web/src/features/examples",
        },
        reference: {
          components: "apps/reference/src/features/components",
          routes: "apps/reference/src/app",
        },
        generated: {
          openApi: {
            schema: "apps/web/src/lib/api/contracts/schema.ts",
          },
        },
        capabilities: {
          openApi: false,
        },
      },
      null,
      2
    )}\n`
  );
  mkdirSync(path.join(tempRoot, "packages/ui"), { recursive: true });
  writeFileSync(
    path.join(tempRoot, "packages/ui/package.json"),
    `${JSON.stringify({ name: "@atlas/ui", version: "0.1.0", private: true }, null, 2)}\n`
  );
  mkdirSync(path.join(tempRoot, "apps/web/src/features"), { recursive: true });
  mkdirSync(path.join(tempRoot, "apps/web/src/features/examples"), { recursive: true });
  mkdirSync(path.join(tempRoot, "apps/reference/src/features/components"), { recursive: true });
  mkdirSync(path.join(tempRoot, "apps/reference/src/app"), { recursive: true });
}

describe("atlas CLI executable", () => {
  const repoRoot = getRepoRoot();
  const cliVersion = readCliAtlasVersion();

  it("prints help with exit 0", () => {
    const result = runAtlasCli(["--help"], repoRoot);

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(result.stdout).toContain("Atlas CLI");
    expect(result.stdout).toContain("init");
    expect(result.stdout).toContain("generate");
    expect(result.stdout).toContain("doctor");
    expect(result.stdout).toContain("sync");
  });

  it("prints version with exit 0", () => {
    const result = runAtlasCli(["--version"], repoRoot);

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(result.stdout.trim()).toBe(cliVersion);
  });

  it("prints JSON version without decoration", () => {
    const result = runAtlasCli(["--version", "--json"], repoRoot);

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(result.stderr).toBe("");
    const payload = JSON.parse(result.stdout) as {
      ok: boolean;
      result: { atlasVersion: string; contractSchemaVersion: number; cliPackage: string };
    };
    expect(payload.ok).toBe(true);
    expect(payload.result.atlasVersion).toBe(cliVersion);
    expect(payload.result.contractSchemaVersion).toBe(1);
    expect(payload.result.cliPackage).toBe("@atlas/cli");
  });

  it("returns non-zero for unknown command", () => {
    const result = runAtlasCli(["unknown-command"], repoRoot);

    expect(result.exitCode).toBe(ExitCode.USAGE_ERROR);
    expect(result.stderr).toContain("Unknown command");
  });

  it("returns non-zero when project context is missing", () => {
    const outside = mkdtempSync(path.join(os.tmpdir(), "atlas-cli-outside-"));

    const result = runAtlasCli(["init"], outside);

    expect(result.exitCode).toBe(ExitCode.PROJECT_NOT_FOUND);
    expect(result.stderr).toContain("Atlas project not found");
  });

  it("discovers repo root from nested directories", () => {
    const result = runAtlasCli(["--version"], path.join(repoRoot, "apps/web/src/features"));

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(result.stdout.trim()).toBe(cliVersion);
  });

  it("prints CLI version from an empty unrelated directory", () => {
    const outside = mkdtempSync(path.join(os.tmpdir(), "atlas-cli-empty-"));
    const result = runAtlasCli(["--version"], outside);

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(result.stdout.trim()).toBe(cliVersion);
  });

  it("does not use unrelated package.json version for --version", () => {
    const outside = mkdtempSync(path.join(os.tmpdir(), "atlas-cli-unrelated-"));
    writeFileSync(
      path.join(outside, "package.json"),
      `${JSON.stringify({ name: "some-other-project", version: "99.0.0" }, null, 2)}\n`,
      "utf8"
    );

    const result = runAtlasCli(["--version"], outside);

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(result.stdout.trim()).toBe(cliVersion);
    expect(result.stdout.trim()).not.toBe("99.0.0");
  });

  it("prints JSON version outside an Atlas project", () => {
    const outside = mkdtempSync(path.join(os.tmpdir(), "atlas-cli-json-outside-"));
    const result = runAtlasCli(["--version", "--json"], outside);

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(result.stderr).toBe("");
    const payload = JSON.parse(result.stdout) as {
      ok: boolean;
      command: string;
      result: { atlasVersion: string };
    };
    expect(payload.ok).toBe(true);
    expect(payload.command).toBe("version");
    expect(payload.result.atlasVersion).toBe(cliVersion);
  });

  it("identifies init in JSON errors when --cwd precedes the command", () => {
    const result = runAtlasCli(["--cwd", "/does-not-exist", "init", "--json"], repoRoot);

    expect(result.exitCode).not.toBe(ExitCode.SUCCESS);
    const payload = JSON.parse(result.stdout) as {
      ok: boolean;
      command: string;
      error: { code: string; message: string };
    };
    expect(payload.ok).toBe(false);
    expect(payload.command).toBe("init");
    expect(payload.error.code).toBeDefined();
  });

  it("uses atlas as JSON command fallback for malformed global options", () => {
    const result = runAtlasCli(["--cwd", "--json"], repoRoot);

    expect(result.exitCode).toBe(ExitCode.USAGE_ERROR);
    const payload = JSON.parse(result.stdout) as {
      ok: boolean;
      command: string;
      error: { code: string; message: string };
    };
    expect(payload.ok).toBe(false);
    expect(payload.command).toBe("atlas");
    expect(payload.error.code).toBe(CliErrorCode.USAGE_ERROR);
  });
});

describe("atlas init bootstrap", () => {
  const cliVersion = readCliAtlasVersion();

  it("creates atlas.config.json in a compatible checkout", () => {
    const fixture = createMinimalAtlasFixture({ withEnvExample: true });
    const contractPath = path.join(fixture.root, "atlas.config.json");

    expect(existsSync(contractPath)).toBe(false);

    const result = runAtlasCli(["init", "--cwd", fixture.root, "--env", "copy"], fixture.root);

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(existsSync(contractPath)).toBe(true);
    expect(() => resolveAtlasProject(fixture.root)).not.toThrow();
    expect(existsSync(path.join(fixture.root, "apps/web/.env.local"))).toBe(true);
  });

  it("does not overwrite an existing valid contract", () => {
    const fixture = createMinimalAtlasFixture({ withContract: true });
    const contractPath = path.join(fixture.root, "atlas.config.json");
    const before = readFileSync(contractPath, "utf8");

    const result = runAtlasCli(["init", "--cwd", fixture.root], fixture.root);

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(readFileSync(contractPath, "utf8")).toBe(before);
    expect(result.stdout).toContain("already initialized");
  });

  it("does not apply init options after the project is already initialized", () => {
    const fixture = createMinimalAtlasFixture({ withContract: true, withReferencePaths: true });
    const before = snapshotFixturePaths(fixture.root);

    const result = runAtlasCli(
      ["init", "--cwd", fixture.root, "--reference", "remove", "--env", "copy"],
      fixture.root
    );

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(result.stdout).toContain("already initialized");
    expect(snapshotFixturePaths(fixture.root)).toEqual(before);
  });

  it("supports dry-run without writing files", () => {
    const fixture = createMinimalAtlasFixture();
    const contractPath = path.join(fixture.root, "atlas.config.json");

    const result = runAtlasCli(["init", "--cwd", fixture.root, "--dry-run"], fixture.root);

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(existsSync(contractPath)).toBe(false);
    expect(result.stdout).toContain("dry run");
  });

  it("returns JSON output for init", () => {
    const fixture = createMinimalAtlasFixture();
    const result = runAtlasCli(
      ["init", "--cwd", fixture.root, "--dry-run", "--json"],
      fixture.root
    );

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    const payload = JSON.parse(result.stdout) as {
      ok: boolean;
      command: string;
      result: { actions: unknown[] };
    };
    expect(payload.ok).toBe(true);
    expect(payload.command).toBe("init");
    expect(Array.isArray(payload.result.actions)).toBe(true);
    expect(result.stdout).not.toMatch(/✓/);
  });

  it("fails with CONTRACT_INVALID for malformed existing atlas.config.json", () => {
    const fixture = createMinimalAtlasFixture({ invalidContract: true });
    const before = snapshotFixturePaths(fixture.root);

    const result = runAtlasCli(["init", "--cwd", fixture.root], fixture.root);

    expect(result.exitCode).toBe(ExitCode.CONTRACT_INVALID);
    expect(result.stderr).toContain("invalid JSON");
    expect(snapshotFixturePaths(fixture.root)).toEqual(before);
  });

  it("returns JSON CONTRACT_INVALID for malformed existing atlas.config.json", () => {
    const fixture = createMinimalAtlasFixture({ invalidContract: true });

    const result = runAtlasCli(["init", "--cwd", fixture.root, "--json"], fixture.root);

    expect(result.exitCode).toBe(ExitCode.CONTRACT_INVALID);
    const payload = JSON.parse(result.stdout) as {
      ok: boolean;
      command: string;
      error: { code: string; message: string };
    };
    expect(payload.ok).toBe(false);
    expect(payload.command).toBe("init");
    expect(payload.error.code).toBe(CliErrorCode.CONTRACT_INVALID);
    expect(payload.error.message).toContain("invalid JSON");
  });

  it("fails with CONTRACT_INVALID for structurally invalid existing atlas.config.json", () => {
    const fixture = createMinimalAtlasFixture({ structurallyInvalidContract: true });
    const before = snapshotFixturePaths(fixture.root);

    const result = runAtlasCli(["init", "--cwd", fixture.root], fixture.root);

    expect(result.exitCode).toBe(ExitCode.CONTRACT_INVALID);
    expect(result.stderr).toContain("UI package mismatch");
    expect(result.stdout).not.toContain("already initialized");
    expect(snapshotFixturePaths(fixture.root)).toEqual(before);
  });

  it("validates prospective contract before writing atlas.config.json", () => {
    const fixture = createMinimalAtlasFixture({ wrongUiPackageName: true });
    const before = snapshotFixturePaths(fixture.root);

    const result = runAtlasCli(["init", "--cwd", fixture.root], fixture.root);

    expect(result.exitCode).toBe(ExitCode.CONTRACT_INVALID);
    expect(existsSync(path.join(fixture.root, "atlas.config.json"))).toBe(false);
    expect(snapshotFixturePaths(fixture.root)).toEqual(before);
  });

  it("sets openApi false when OpenAPI artifacts are absent", () => {
    const fixture = createMinimalAtlasFixture();
    const result = runAtlasCli(["init", "--cwd", fixture.root], fixture.root);

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    const contract = JSON.parse(
      readFileSync(path.join(fixture.root, "atlas.config.json"), "utf8")
    ) as { capabilities?: { openApi?: boolean } };
    expect(contract.capabilities?.openApi).toBe(false);
    expect(() => resolveAtlasProject(fixture.root)).not.toThrow();
  });

  it("does not overwrite an existing .env.local", () => {
    const fixture = createMinimalAtlasFixture({ withEnvExample: true, withEnvLocal: true });
    const envLocalPath = path.join(fixture.root, "apps/web/.env.local");
    const before = readFileSync(envLocalPath, "utf8");

    const result = runAtlasCli(["init", "--cwd", fixture.root, "--env", "copy"], fixture.root);

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(readFileSync(envLocalPath, "utf8")).toBe(before);
  });

  it("removes reference paths only when explicitly requested", () => {
    const fixture = createMinimalAtlasFixture({ withReferencePaths: true });
    const referencePath = path.join(fixture.root, "apps/reference/src/features");

    expect(existsSync(referencePath)).toBe(true);

    const result = runAtlasCli(
      ["init", "--cwd", fixture.root, "--reference", "remove"],
      fixture.root
    );

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(existsSync(referencePath)).toBe(false);
  });

  it("does not remove reference paths during dry-run", () => {
    const fixture = createMinimalAtlasFixture({ withReferencePaths: true });
    const referencePath = path.join(fixture.root, "apps/reference/src/features");

    const result = runAtlasCli(
      ["init", "--cwd", fixture.root, "--reference", "remove", "--dry-run"],
      fixture.root
    );

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(existsSync(referencePath)).toBe(true);
    expect(result.stdout).toContain("dry run");
  });

  it("reports checkout atlas version during init", () => {
    const fixture = createMinimalAtlasFixture();
    const result = runAtlasCli(["init", "--cwd", fixture.root, "--dry-run"], fixture.root);

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(result.stdout).toContain(`Atlas version: ${cliVersion}`);
  });
});

describe("atlas sync infrastructure", () => {
  const repoRoot = getRepoRoot();

  it("passes check on the healthy checkout", () => {
    const result = runAtlasCli(["sync", "infrastructure", "--check"], repoRoot);
    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(result.stdout).toContain("Initial drifted synced paths: 0");
    expect(result.stdout).toContain("Final health: healthy");
  });

  it("repairs drift through the CLI executable", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-sync-cli-"));
    const canonicalRoot = path.join(tempRoot, "apps/web");
    const consumerRoot = path.join(tempRoot, "apps/reference");
    mkdirSync(path.join(canonicalRoot, "src/lib/api"), { recursive: true });
    mkdirSync(path.join(consumerRoot, "src/lib/api"), { recursive: true });
    writeMinimalAtlasRepo(tempRoot);
    mkdirSync(path.join(tempRoot, "templates"), { recursive: true });

    writeFileSync(
      path.join(canonicalRoot, "src/lib/api/client.ts"),
      "export const canonical = true;\n"
    );
    writeFileSync(
      path.join(consumerRoot, "src/lib/api/client.ts"),
      "export const consumer = true;\n"
    );
    writeFileSync(
      path.join(tempRoot, "templates/app-infrastructure.manifest.json"),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          canonicalApplication: "apps/web",
          consumerApplications: ["apps/reference"],
          syncedPaths: ["src/lib/api/client.ts"],
          generatedPaths: [],
          independentPaths: {},
          referenceOnlyPaths: [],
          starterOnlyPaths: [],
          structuralConformance: { requiredInfrastructureModules: [] },
        },
        null,
        2
      )}\n`
    );

    const checkDrift = runAtlasCli(
      ["sync", "infrastructure", "--check", "--cwd", tempRoot],
      tempRoot
    );
    expect(checkDrift.exitCode).toBe(ExitCode.DOCTOR_FAILED);
    expect(checkDrift.stdout).toContain("Initial drifted synced paths: 1");

    const dryRun = runAtlasCli(
      ["sync", "infrastructure", "--dry-run", "--cwd", tempRoot],
      tempRoot
    );
    expect(dryRun.exitCode).toBe(ExitCode.DOCTOR_FAILED);
    expect(readFileSync(path.join(consumerRoot, "src/lib/api/client.ts"), "utf8")).toContain(
      "consumer"
    );

    const repair = runAtlasCli(["sync", "infrastructure", "--cwd", tempRoot], tempRoot);
    expect(repair.exitCode).toBe(ExitCode.SUCCESS);
    expect(repair.stdout).toContain("Applied actions: 1");
    expect(repair.stdout).toContain("Final health: healthy");
    expect(readFileSync(path.join(consumerRoot, "src/lib/api/client.ts"), "utf8")).toContain(
      "canonical"
    );

    const checkClean = runAtlasCli(
      ["sync", "infrastructure", "--check", "--cwd", tempRoot],
      tempRoot
    );
    expect(checkClean.exitCode).toBe(ExitCode.SUCCESS);

    rmSync(tempRoot, { recursive: true, force: true });
  });
});
