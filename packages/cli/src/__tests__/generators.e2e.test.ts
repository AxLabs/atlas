import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { ExitCode } from "../exit-codes";
import { CliErrorCode } from "../errors/cli-error";
import { renderFeatureMutations, renderFeatureQueries } from "../generators/templates/feature";
import { parseFeatureName } from "../generators/naming";

import { createGeneratorAtlasFixture, readFixtureTree, readGeneratedTree } from "./helpers/fixture";
import { getRepoRoot, runAtlasCli } from "./helpers/run-cli";
import {
  createGeneratedSourceValidationFixture,
  removeGeneratedSourceValidationFixture,
  stageGeneratedOutput,
  validateGeneratedWebSource,
  writeGeneratedValidationFeatureFile,
} from "./helpers/validation-fixture";

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
    expect(result.stdout).toContain("Include deterministic query-key tests (requires --query)");
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
  it("generates query keys with the public react-query entry point", () => {
    const fixture = createGeneratorAtlasFixture({ withContract: true, withReferencePaths: true });
    const result = runAtlasCli(
      ["generate", "feature", "example-query", "--query", "--cwd", fixture.root],
      fixture.root
    );

    expect(result.exitCode).toBe(ExitCode.SUCCESS);

    const keysPath = path.join(fixture.root, "apps/web/src/features/example-query/keys.ts");
    const keysSource = readFileSync(keysPath, "utf8");
    expect(keysSource).toContain('from "@/lib/react-query"');
    expect(keysSource).not.toContain('from "@/lib/react-query/keys"');
  });

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
      {
        kind: "create",
        path: "apps/web/src/features/example/components/ExampleFeature.tsx",
      },
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
      ["generate", "feature", "examples", "--cwd", fixture.root],
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
    expect(existsSync(path.join(featureRoot, "components/ExampleFeature.tsx"))).toBe(false);
  });

  it("fails atomically when the feature directory already exists", () => {
    const fixture = createGeneratorAtlasFixture({ withContract: true, withReferencePaths: true });
    const featureRoot = path.join(fixture.root, "apps/web/src/features/example");
    const componentsDir = path.join(featureRoot, "components");
    mkdirSync(componentsDir, { recursive: true });
    writeFileSync(
      path.join(componentsDir, "ExampleFeature.tsx"),
      "export function ExampleFeature() {}\n",
      "utf8"
    );

    const result = runAtlasCli(
      ["generate", "feature", "example", "--cwd", fixture.root],
      fixture.root
    );

    expect(result.exitCode).toBe(ExitCode.GENERATOR_CONFLICT);
    expect(existsSync(path.join(featureRoot, "index.ts"))).toBe(false);
    expect(readFileSync(path.join(componentsDir, "ExampleFeature.tsx"), "utf8")).toBe(
      "export function ExampleFeature() {}\n"
    );
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

  it("generates query-key tests only when --query and --tests are used together", () => {
    const fixture = createGeneratorAtlasFixture({ withContract: true, withReferencePaths: true });
    const result = runAtlasCli(
      ["generate", "feature", "users", "--query", "--tests", "--cwd", fixture.root],
      fixture.root
    );

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(
      existsSync(path.join(fixture.root, "apps/web/src/features/users/__tests__/keys.test.ts"))
    ).toBe(true);
  });

  it.each([
    ["--mutation --tests", ["generate", "feature", "users", "--mutation", "--tests"]],
    ["--form --tests", ["generate", "feature", "users", "--form", "--tests"]],
    ["--tests", ["generate", "feature", "users", "--tests"]],
  ])("rejects %s without --query", (_label, args) => {
    const fixture = createGeneratorAtlasFixture({ withContract: true, withReferencePaths: true });
    const result = runAtlasCli([...args, "--cwd", fixture.root], fixture.root);

    expect(result.exitCode).toBe(ExitCode.USAGE_ERROR);
    expect(result.stderr).toContain("The --tests flag requires --query.");
  });

  it("does not invent non-OpenAPI endpoints in query or mutation scaffolds", () => {
    const naming = parseFeatureName("billing-history");
    const context = { naming, openApiEnabled: false };
    const querySource = renderFeatureQueries(context);
    const mutationSource = renderFeatureMutations(context);

    expect(querySource).not.toMatch(/["'`]\/api\//);
    expect(mutationSource).not.toMatch(/["'`]\/api\//);
    expect(querySource).toContain("fetchBillingHistoryList");
    expect(mutationSource).toContain("createBillingHistory");
    expect(mutationSource).not.toContain("apiPost<unknown, unknown>");
    expect(mutationSource).not.toContain("apiPost");
  });

  it("does not invent typed OpenAPI client members in scaffolds", () => {
    const naming = parseFeatureName("billing-history");
    const context = { naming, openApiEnabled: true };
    const querySource = renderFeatureQueries(context);
    const mutationSource = renderFeatureMutations(context);

    expect(querySource).not.toMatch(/api\.[a-zA-Z]+\./);
    expect(mutationSource).not.toMatch(/api\.[a-zA-Z]+\./);
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

  it("accepts identifier-safe dynamic routes", () => {
    const fixture = createGeneratorAtlasFixture({ withContract: true, withReferencePaths: true });

    for (const route of ["users/[id]", "users/[userId]"]) {
      const result = runAtlasCli(["generate", "page", route, "--cwd", fixture.root], fixture.root);
      expect(result.exitCode).toBe(ExitCode.SUCCESS);
    }

    const dynamicPage = readFileSync(
      path.join(fixture.root, "apps/web/src/app/users/[id]/page.tsx"),
      "utf8"
    );
    expect(dynamicPage).toContain("export default function UsersIdPage()");
  });

  it("rejects invalid dynamic route identifiers", () => {
    const fixture = createGeneratorAtlasFixture({ withContract: true, withReferencePaths: true });
    const cases = ["users/[123]", "users/[user-id]", "users/[../id]"];

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

describe("generated source validation", () => {
  const validationCases = [
    {
      label: "default feature",
      args: ["generate", "feature", "example"],
      generatedRoot: "src/features/example",
      kind: "feature" as const,
      name: "example",
    },
    {
      label: "query feature",
      args: ["generate", "feature", "example-query", "--query"],
      generatedRoot: "src/features/example-query",
      kind: "feature" as const,
      name: "example-query",
    },
    {
      label: "mutation feature",
      args: ["generate", "feature", "example-mutation", "--mutation"],
      generatedRoot: "src/features/example-mutation",
      kind: "feature" as const,
      name: "example-mutation",
    },
    {
      label: "form feature",
      args: ["generate", "feature", "example-form", "--form"],
      generatedRoot: "src/features/example-form",
      kind: "feature" as const,
      name: "example-form",
    },
    {
      label: "combined feature",
      args: ["generate", "feature", "example-full", "--query", "--mutation", "--form", "--tests"],
      generatedRoot: "src/features/example-full",
      kind: "feature" as const,
      name: "example-full",
    },
    {
      label: "static page",
      args: ["generate", "page", "settings/profile"],
      generatedRoot: "src/app/settings/profile",
      kind: "app" as const,
      name: "settings/profile",
    },
    {
      label: "dynamic page",
      args: ["generate", "page", "users/[id]"],
      generatedRoot: "src/app/users/[id]",
      kind: "app" as const,
      name: "users/[id]",
    },
  ] as const;

  it.each(validationCases)(
    "validates $label against real Atlas app tooling",
    ({ args, generatedRoot, kind, name }) => {
      const fixture = createGeneratedSourceValidationFixture();
      try {
        const result = runAtlasCli([...args, "--cwd", fixture.root], fixture.root);

        expect(result.exitCode).toBe(ExitCode.SUCCESS);
        const stagedPaths = stageGeneratedOutput(fixture, {
          generatedRelativeRoot: generatedRoot,
          kind,
          name,
        });

        const validation = validateGeneratedWebSource(fixture, stagedPaths);
        if (validation.typecheck.exitCode !== 0) {
          throw new Error(
            `Typecheck failed for ${args.join(" ")}\n${validation.typecheck.stdout}\n${validation.typecheck.stderr}`
          );
        }
        if (validation.eslint.exitCode !== 0) {
          throw new Error(
            `ESLint failed for ${args.join(" ")}\n${validation.eslint.stdout}\n${validation.eslint.stderr}`
          );
        }
        if (validation.prettier.exitCode !== 0) {
          throw new Error(
            `Prettier failed for ${args.join(" ")}\n${validation.prettier.stdout}\n${validation.prettier.stderr}`
          );
        }
      } finally {
        removeGeneratedSourceValidationFixture(fixture);
      }
    }
  );
});

describe("generated source validation harness", () => {
  it("fails ESLint for raw fetch in staged feature paths", () => {
    const fixture = createGeneratedSourceValidationFixture();
    try {
      const invalidPath = writeGeneratedValidationFeatureFile(
        fixture,
        "invalid-fetch",
        "bad.ts",
        `export async function bad() {
  return fetch("/should-fail");
}
`
      );

      const validation = validateGeneratedWebSource(fixture, [invalidPath]);
      expect(validation.eslint.exitCode).not.toBe(0);
    } finally {
      removeGeneratedSourceValidationFixture(fixture);
    }
  });

  it("fails ESLint for forbidden env imports in staged feature paths", () => {
    const fixture = createGeneratedSourceValidationFixture();
    try {
      const invalidPath = writeGeneratedValidationFeatureFile(
        fixture,
        "invalid-import",
        "bad.ts",
        `import { serverEnv } from "@/env";

export function bad() {
  return serverEnv.NODE_ENV;
}
`
      );

      const validation = validateGeneratedWebSource(fixture, [invalidPath]);
      expect(validation.eslint.exitCode).not.toBe(0);
    } finally {
      removeGeneratedSourceValidationFixture(fixture);
    }
  });

  it("passes ESLint for a valid generated feature staged under real feature paths", () => {
    const fixture = createGeneratedSourceValidationFixture();
    try {
      const result = runAtlasCli(
        ["generate", "feature", "example", "--cwd", fixture.root],
        fixture.root
      );

      expect(result.exitCode).toBe(ExitCode.SUCCESS);

      const stagedPaths = stageGeneratedOutput(fixture, {
        generatedRelativeRoot: "src/features/example",
        kind: "feature",
        name: "example",
      });

      const validation = validateGeneratedWebSource(fixture, stagedPaths);
      expect(validation.eslint.exitCode).toBe(0);
    } finally {
      removeGeneratedSourceValidationFixture(fixture);
    }
  });
});
