import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { ExitCode } from "../exit-codes";
import { CliErrorCode } from "../errors/cli-error";

import { createGeneratorAtlasFixture, readFixtureTree, readGeneratedTree } from "./helpers/fixture";
import { getRepoRoot, runAtlasCli } from "./helpers/run-cli";

describe("atlas generate command", () => {
  const repoRoot = getRepoRoot();

  it("prints generate in top-level help", () => {
    const result = runAtlasCli(["--help"], repoRoot);

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(result.stdout).toContain("generate");
  });

  it("prints generate help", () => {
    const result = runAtlasCli(["generate", "--help"], repoRoot);

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(result.stdout).toContain("atlas generate feature");
    expect(result.stdout).toContain("atlas generate page");
  });

  it("requires an initialized Atlas project", () => {
    const fixture = createGeneratorAtlasFixture();
    const result = runAtlasCli(
      ["generate", "feature", "example", "--cwd", fixture.root],
      fixture.root
    );

    expect(result.exitCode).toBe(ExitCode.PROJECT_NOT_FOUND);
  });
});

describe("atlas generate feature", () => {
  it("matches the default golden fixture", () => {
    const fixture = createGeneratorAtlasFixture({ withContract: true, withReferencePaths: true });
    const result = runAtlasCli(
      ["generate", "feature", "example", "--cwd", fixture.root],
      fixture.root
    );

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(readGeneratedTree(fixture.root, "apps/web/src/features/example")).toEqual(
      readFixtureTree("feature-default")
    );
  });

  it("supports dry-run without writing files", () => {
    const fixture = createGeneratorAtlasFixture({ withContract: true, withReferencePaths: true });
    const result = runAtlasCli(
      ["generate", "feature", "example", "--dry-run", "--cwd", fixture.root],
      fixture.root
    );

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(result.stdout).toContain("dry run");
    expect(existsSync(path.join(fixture.root, "apps/web/src/features/example"))).toBe(false);
  });

  it("returns deterministic JSON output", () => {
    const fixture = createGeneratorAtlasFixture({ withContract: true, withReferencePaths: true });
    const result = runAtlasCli(
      ["generate", "feature", "example", "--dry-run", "--json", "--cwd", fixture.root],
      fixture.root
    );

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    const payload = JSON.parse(result.stdout) as {
      ok: boolean;
      command: string;
      result: {
        repoRoot: string;
        dryRun: boolean;
        actions: { kind: string; path: string }[];
        followUpActions: string[];
      };
    };
    expect(payload.ok).toBe(true);
    expect(payload.command).toBe("generate feature");
    expect(payload.result.repoRoot).toBe(".");
    expect(payload.result.dryRun).toBe(true);
    expect(payload.result.actions).toEqual([
      { kind: "create", path: "apps/web/src/features/example/index.ts" },
    ]);
    expect(payload.result.followUpActions.length).toBeGreaterThan(0);
  });

  it("generates under a custom contract feature root", () => {
    const fixture = createGeneratorAtlasFixture({
      withContract: true,
      withReferencePaths: true,
      customProductFeaturesRoot: "apps/web/src/domains",
      openApi: false,
    });

    const result = runAtlasCli(
      ["generate", "feature", "billing-history", "--query", "--cwd", fixture.root],
      fixture.root
    );

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(existsSync(path.join(fixture.root, "apps/web/src/features/billing-history"))).toBe(
      false
    );
    expect(readGeneratedTree(fixture.root, "apps/web/src/domains/billing-history")).toEqual(
      readFixtureTree("feature-with-query")
    );
  });

  it("rejects reserved feature names", () => {
    const fixture = createGeneratorAtlasFixture({ withContract: true, withReferencePaths: true });
    const result = runAtlasCli(
      ["generate", "feature", "reference", "--cwd", fixture.root],
      fixture.root
    );

    expect(result.exitCode).toBe(ExitCode.USAGE_ERROR);
    expect(result.stderr).toContain("reserved");
  });

  it("rejects unsafe feature names", () => {
    const fixture = createGeneratorAtlasFixture({ withContract: true, withReferencePaths: true });
    const cases = ["../users", "/users", "users/../admin", ".", ".."];

    for (const name of cases) {
      const result = runAtlasCli(
        ["generate", "feature", name, "--cwd", fixture.root],
        fixture.root
      );
      expect(result.exitCode).toBe(ExitCode.USAGE_ERROR);
    }
  });

  it("fails atomically when any destination file already exists", () => {
    const fixture = createGeneratorAtlasFixture({ withContract: true, withReferencePaths: true });
    const featureRoot = path.join(fixture.root, "apps/web/src/features/example");
    mkdirSync(featureRoot, { recursive: true });
    writeFileSync(path.join(featureRoot, "index.ts"), "existing\n", "utf8");
    writeFileSync(path.join(featureRoot, "keys.ts"), "existing\n", "utf8");

    const result = runAtlasCli(
      ["generate", "feature", "example", "--query", "--cwd", fixture.root],
      fixture.root
    );

    expect(result.exitCode).toBe(ExitCode.GENERATOR_CONFLICT);
    expect(readFileSync(path.join(featureRoot, "index.ts"), "utf8")).toBe("existing\n");
    expect(existsSync(path.join(featureRoot, "queries.ts"))).toBe(false);
  });

  it("returns JSON for generator conflicts", () => {
    const fixture = createGeneratorAtlasFixture({ withContract: true, withReferencePaths: true });
    const featureRoot = path.join(fixture.root, "apps/web/src/features/example");
    mkdirSync(featureRoot, { recursive: true });
    writeFileSync(path.join(featureRoot, "index.ts"), "existing\n", "utf8");

    const result = runAtlasCli(
      ["generate", "feature", "example", "--json", "--cwd", fixture.root],
      fixture.root
    );

    expect(result.exitCode).toBe(ExitCode.GENERATOR_CONFLICT);
    const payload = JSON.parse(result.stdout) as {
      ok: boolean;
      error: { code: string };
    };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe(CliErrorCode.GENERATOR_CONFLICT);
  });
});

describe("atlas generate page", () => {
  it("matches the page golden fixture", () => {
    const fixture = createGeneratorAtlasFixture({ withContract: true, withReferencePaths: true });
    const result = runAtlasCli(
      ["generate", "page", "settings/profile", "--cwd", fixture.root],
      fixture.root
    );

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(readGeneratedTree(fixture.root, "apps/web/src/app/settings/profile")).toEqual(
      readFixtureTree("page-settings-profile")
    );
  });

  it("supports dry-run without writing files", () => {
    const fixture = createGeneratorAtlasFixture({ withContract: true, withReferencePaths: true });
    const result = runAtlasCli(
      ["generate", "page", "settings/profile", "--dry-run", "--cwd", fixture.root],
      fixture.root
    );

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(existsSync(path.join(fixture.root, "apps/web/src/app/settings/profile/page.tsx"))).toBe(
      false
    );
  });

  it("can create page.tsx when the route directory already exists", () => {
    const fixture = createGeneratorAtlasFixture({ withContract: true, withReferencePaths: true });
    const routeDir = path.join(fixture.root, "apps/web/src/app/settings");
    mkdirSync(routeDir, { recursive: true });
    writeFileSync(
      path.join(routeDir, "layout.tsx"),
      "export default function Layout() {}\n",
      "utf8"
    );

    const result = runAtlasCli(
      ["generate", "page", "settings", "--cwd", fixture.root],
      fixture.root
    );

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(existsSync(path.join(routeDir, "page.tsx"))).toBe(true);
    expect(readFileSync(path.join(routeDir, "layout.tsx"), "utf8")).toContain("Layout");
  });

  it("conflicts when page.tsx already exists", () => {
    const fixture = createGeneratorAtlasFixture({ withContract: true, withReferencePaths: true });
    const pagePath = path.join(fixture.root, "apps/web/src/app/settings/profile/page.tsx");
    mkdirSync(path.dirname(pagePath), { recursive: true });
    writeFileSync(pagePath, "existing\n", "utf8");

    const result = runAtlasCli(
      ["generate", "page", "settings/profile", "--cwd", fixture.root],
      fixture.root
    );

    expect(result.exitCode).toBe(ExitCode.GENERATOR_CONFLICT);
    expect(readFileSync(pagePath, "utf8")).toBe("existing\n");
  });

  it("rejects unsafe routes", () => {
    const fixture = createGeneratorAtlasFixture({ withContract: true, withReferencePaths: true });
    const cases = ["../settings", "/settings", "settings/../../admin", "settings//profile"];

    for (const route of cases) {
      const result = runAtlasCli(["generate", "page", route, "--cwd", fixture.root], fixture.root);
      expect(result.exitCode).toBe(ExitCode.USAGE_ERROR);
    }
  });
});

describe("atlas generate determinism", () => {
  it("produces byte-identical output for repeated runs", () => {
    const fixtureA = createGeneratorAtlasFixture({ withContract: true, withReferencePaths: true });
    const fixtureB = createGeneratorAtlasFixture({ withContract: true, withReferencePaths: true });

    expect(
      runAtlasCli(["generate", "feature", "example", "--cwd", fixtureA.root], fixtureA.root)
        .exitCode
    ).toBe(ExitCode.SUCCESS);
    expect(
      runAtlasCli(["generate", "feature", "example", "--cwd", fixtureB.root], fixtureB.root)
        .exitCode
    ).toBe(ExitCode.SUCCESS);

    expect(readGeneratedTree(fixtureA.root, "apps/web/src/features/example")).toEqual(
      readGeneratedTree(fixtureB.root, "apps/web/src/features/example")
    );
  });
});
