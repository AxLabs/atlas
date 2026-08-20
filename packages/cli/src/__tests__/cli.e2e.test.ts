import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { ExitCode } from "../exit-codes";
import { resolveAtlasProject } from "@atlas/project";

import { createMinimalAtlasFixture } from "./helpers/fixture";
import { getRepoRoot, runAtlasCli } from "./helpers/run-cli";

describe("atlas CLI executable", () => {
  const repoRoot = getRepoRoot();

  it("prints help with exit 0", () => {
    const result = runAtlasCli(["--help"], repoRoot);

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(result.stdout).toContain("Atlas CLI");
    expect(result.stdout).toContain("init");
    expect(result.stdout).not.toContain("generate");
    expect(result.stdout).not.toContain("doctor");
  });

  it("prints version with exit 0", () => {
    const result = runAtlasCli(["--version"], repoRoot);

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(result.stdout.trim()).toBe("0.1.0");
  });

  it("prints JSON version without decoration", () => {
    const result = runAtlasCli(["--version", "--json"], repoRoot);

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(result.stderr).toBe("");
    const payload = JSON.parse(result.stdout) as {
      ok: boolean;
      result: { atlasVersion: string; contractSchemaVersion: number };
    };
    expect(payload.ok).toBe(true);
    expect(payload.result.atlasVersion).toBe("0.1.0");
    expect(payload.result.contractSchemaVersion).toBe(1);
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
    expect(result.stdout.trim()).toBe("0.1.0");
  });
});

describe("atlas init bootstrap", () => {
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

  it("does not overwrite an existing contract", () => {
    const fixture = createMinimalAtlasFixture({ withContract: true });
    const contractPath = path.join(fixture.root, "atlas.config.json");
    const before = readFileSync(contractPath, "utf8");

    const result = runAtlasCli(["init", "--cwd", fixture.root], fixture.root);

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(readFileSync(contractPath, "utf8")).toBe(before);
    expect(result.stdout).toContain("already initialized");
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
});
