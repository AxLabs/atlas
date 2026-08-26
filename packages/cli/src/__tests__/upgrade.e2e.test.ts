import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { ExitCode } from "../exit-codes";
import { runAtlasCli } from "./helpers/run-cli";

const FIXTURE_ROOT = path.resolve(__dirname, "fixtures/upgrade-e2e");
const CONFLICT_FIXTURE_ROOT = path.resolve(__dirname, "fixtures/upgrade-e2e-conflict");

function copyFixtureToTemp(sourceRoot: string): string {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-upgrade-e2e-"));

  const copyRecursive = (relativeDir: string): void => {
    const sourceDir = path.join(sourceRoot, relativeDir);
    for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(tempRoot, relativeDir, entry.name);
      if (entry.isDirectory()) {
        mkdirSync(targetPath, { recursive: true });
        copyRecursive(path.join(relativeDir, entry.name));
      } else {
        mkdirSync(path.dirname(targetPath), { recursive: true });
        writeFileSync(targetPath, readFileSync(sourcePath));
      }
    }
  };

  copyRecursive(".");
  return tempRoot;
}

function parseUpgradeJson(stdout: string): {
  ok: boolean;
  result?: {
    status: string;
    baselineUpdated?: boolean;
    appliedPaths?: string[];
    conflicts?: unknown[];
  };
} {
  return JSON.parse(stdout) as {
    ok: boolean;
    result?: {
      status: string;
      baselineUpdated?: boolean;
      appliedPaths?: string[];
      conflicts?: unknown[];
    };
  };
}

describe("upgrade e2e", () => {
  it("dry-run produces a plan without mutating baseline or consumer files", () => {
    const tempRoot = copyFixtureToTemp(FIXTURE_ROOT);
    const contractBefore = readFileSync(path.join(tempRoot, "atlas.config.json"), "utf8");
    const errorsBefore = readFileSync(
      path.join(tempRoot, "apps/web/src/lib/api/errors.ts"),
      "utf8"
    );

    const result = runAtlasCli(
      ["upgrade", "--to", "0.2.0", "--dry-run", "--json", "--skip-validation"],
      tempRoot
    );

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    const payload = parseUpgradeJson(result.stdout);
    expect(payload.ok).toBe(true);
    expect(payload.result?.status).toBe("planned");
    expect(readFileSync(path.join(tempRoot, "atlas.config.json"), "utf8")).toBe(contractBefore);
    expect(readFileSync(path.join(tempRoot, "apps/web/src/lib/api/errors.ts"), "utf8")).toBe(
      errorsBefore
    );

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("applies safe synced-path replacements and advances baseline on success", () => {
    const tempRoot = copyFixtureToTemp(FIXTURE_ROOT);

    const dryRun = runAtlasCli(
      ["upgrade", "--to", "0.2.0", "--dry-run", "--json", "--skip-validation"],
      tempRoot
    );
    expect(dryRun.exitCode).toBe(ExitCode.SUCCESS);

    const apply = runAtlasCli(
      ["upgrade", "--to", "0.2.0", "--json", "--skip-validation", "--allow-dirty"],
      tempRoot
    );
    expect(apply.exitCode).toBe(ExitCode.SUCCESS);

    const payload = parseUpgradeJson(apply.stdout);
    expect(payload.result?.status).toBe("success");
    expect(payload.result?.baselineUpdated).toBe(true);
    expect(readFileSync(path.join(tempRoot, "apps/web/src/lib/api/errors.ts"), "utf8")).toContain(
      "fixed"
    );
    expect(readFileSync(path.join(tempRoot, "apps/web/src/lib/auth/session.ts"), "utf8")).toContain(
      "secure-baseline"
    );

    const contract = JSON.parse(readFileSync(path.join(tempRoot, "atlas.config.json"), "utf8"));
    expect(contract.platform.baseline.atlasVersion).toBe("0.2.0");

    const secondDryRun = runAtlasCli(
      ["upgrade", "--to", "0.2.0", "--dry-run", "--json", "--skip-validation"],
      tempRoot
    );
    const secondPayload = parseUpgradeJson(secondDryRun.stdout);
    expect(secondPayload.result?.status).toBe("already-current");

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("refuses mutation when synced paths conflict and preserves consumer content", () => {
    const tempRoot = copyFixtureToTemp(CONFLICT_FIXTURE_ROOT);

    const result = runAtlasCli(
      ["upgrade", "--to", "0.2.0", "--json", "--skip-validation", "--allow-dirty"],
      tempRoot
    );

    expect(result.exitCode).toBe(ExitCode.UPGRADE_BLOCKED);
    const payload = parseUpgradeJson(result.stdout);
    expect(payload.result?.status).toBe("blocked");
    expect(payload.result?.baselineUpdated).toBe(false);
    expect(readFileSync(path.join(tempRoot, "apps/web/src/lib/auth/session.ts"), "utf8")).toContain(
      "consumer-custom-auth"
    );

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("fails when migration chain is missing for non-adjacent target", () => {
    const tempRoot = copyFixtureToTemp(FIXTURE_ROOT);

    const result = runAtlasCli(
      ["upgrade", "--to", "0.3.0", "--dry-run", "--json", "--skip-validation"],
      tempRoot
    );

    expect(result.exitCode).toBe(ExitCode.UPGRADE_PREREQUISITE);

    rmSync(tempRoot, { recursive: true, force: true });
  });
});
