import { readFileSync } from "node:fs";
import path from "node:path";

import {
  shouldOmitConsumerUiDevDependency,
  shouldOmitConsumerUiScript,
  toConsumerUiPackageManifest,
} from "../bootstrap/consumer-ui-manifest";
import { BootstrapAssetError } from "../bootstrap/errors";
import { getRepoRoot } from "./helpers/run-cli";

interface PackageManifest {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const CANONICAL_UI_PACKAGE_JSON = path.join(getRepoRoot(), "packages/ui/package.json");

function parseManifest(raw: string): PackageManifest {
  return JSON.parse(raw) as PackageManifest;
}

describe("consumer UI package manifest transform", () => {
  it("strips Storybook, visual, and Husky scripts that the trimmed tree omits", () => {
    const canonical = parseManifest(readFileSync(CANONICAL_UI_PACKAGE_JSON, "utf8"));
    const packaged = parseManifest(
      toConsumerUiPackageManifest(readFileSync(CANONICAL_UI_PACKAGE_JSON, "utf8"))
    );

    expect(canonical.scripts?.storybook).toBeDefined();
    expect(canonical.scripts?.["test:visual"]).toBeDefined();
    expect(canonical.scripts?.prepare).toBe("husky");

    expect(packaged.scripts?.storybook).toBeUndefined();
    expect(packaged.scripts?.["build-storybook"]).toBeUndefined();
    expect(packaged.scripts?.["test:storybook"]).toBeUndefined();
    expect(packaged.scripts?.["test:storybook:cross-browser"]).toBeUndefined();
    expect(packaged.scripts?.["test:visual"]).toBeUndefined();
    expect(packaged.scripts?.["test:visual:update"]).toBeUndefined();
    expect(packaged.scripts?.["test:visual:docker"]).toBeUndefined();
    expect(packaged.scripts?.["test:ui-quality"]).toBeUndefined();
    expect(packaged.scripts?.prepare).toBeUndefined();

    for (const [name, value] of Object.entries(packaged.scripts ?? {})) {
      expect(shouldOmitConsumerUiScript(name, value)).toBe(false);
    }

    expect(packaged.scripts?.lint).toBe(canonical.scripts?.lint);
    expect(packaged.scripts?.typecheck).toBe(canonical.scripts?.typecheck);
    expect(packaged.scripts?.test).toBe(canonical.scripts?.test);
    expect(packaged.scripts?.["test:coverage"]).toBe(canonical.scripts?.["test:coverage"]);
    expect(packaged.scripts?.clean).toBe(canonical.scripts?.clean);
  });

  it("removes dead Storybook, Playwright, and Husky devDependencies", () => {
    const canonical = parseManifest(readFileSync(CANONICAL_UI_PACKAGE_JSON, "utf8"));
    const packaged = parseManifest(
      toConsumerUiPackageManifest(readFileSync(CANONICAL_UI_PACKAGE_JSON, "utf8"))
    );
    const packagedDevDependencies = Object.keys(packaged.devDependencies ?? {});

    expect(canonical.devDependencies?.storybook).toBeDefined();
    expect(canonical.devDependencies?.["@playwright/test"]).toBeDefined();
    expect(canonical.devDependencies?.["@storybook/react"]).toBeDefined();

    expect(packaged.devDependencies?.storybook).toBeUndefined();
    expect(packaged.devDependencies?.["@playwright/test"]).toBeUndefined();
    expect(packaged.devDependencies?.["axe-playwright"]).toBeUndefined();
    expect(packaged.devDependencies?.vite).toBeUndefined();
    expect(packaged.devDependencies?.["@tailwindcss/vite"]).toBeUndefined();
    expect(packaged.devDependencies?.husky).toBeUndefined();
    expect(packaged.devDependencies?.["@storybook/react-vite"]).toBeUndefined();
    expect(packaged.devDependencies?.["@storybook/test-runner"]).toBeUndefined();
    expect(packagedDevDependencies.filter((name) => name.startsWith("@storybook/addon-"))).toEqual(
      []
    );

    expect(
      packagedDevDependencies.filter((name) => shouldOmitConsumerUiDevDependency(name))
    ).toEqual([]);

    expect(packaged.devDependencies?.["@storybook/react"]).toBe(
      canonical.devDependencies?.["@storybook/react"]
    );
    expect(packaged.devDependencies?.["@storybook/test"]).toBe(
      canonical.devDependencies?.["@storybook/test"]
    );
    expect(packaged.devDependencies?.["@types/node"]).toBe("22.10.2");
    expect(packaged.devDependencies?.jest).toBe(canonical.devDependencies?.jest);
    expect(packaged.devDependencies?.typescript).toBe(canonical.devDependencies?.typescript);
  });

  it("keeps Node types in the packaged UI tsconfig so typecheck does not rely on omitted Vite", () => {
    const tsconfig = JSON.parse(
      readFileSync(path.join(getRepoRoot(), "packages/ui/tsconfig.json"), "utf8")
    ) as { compilerOptions?: { types?: string[] } };

    expect(tsconfig.compilerOptions?.types).toEqual(["node"]);
  });

  it("is deterministic and does not rewrite the canonical maintainer manifest shape beyond omitted tooling", () => {
    const raw = readFileSync(CANONICAL_UI_PACKAGE_JSON, "utf8");
    const first = toConsumerUiPackageManifest(raw);
    const second = toConsumerUiPackageManifest(raw);

    expect(first).toBe(second);
    expect(first).not.toBe(raw);
    expect(JSON.parse(raw)).toMatchObject({
      name: "@atlas/ui",
      scripts: expect.objectContaining({ storybook: expect.any(String) }),
    });
  });

  it("rejects invalid package manifests", () => {
    expect(() => toConsumerUiPackageManifest("{")).toThrow(BootstrapAssetError);
    expect(() => toConsumerUiPackageManifest("[]")).toThrow(/JSON object/);
    expect(() => toConsumerUiPackageManifest(JSON.stringify({ scripts: { lint: 1 } }))).toThrow(
      /scripts.lint must be a string/
    );
  });
});
