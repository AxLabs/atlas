import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { shouldOmitConsumerUiDevDependency } from "../bootstrap/consumer-ui-manifest";
import { listGeneratedConsumerDocs, listGeneratedCursorFiles } from "../init/consumer-docs";
import { collectDependencyNames, selectConsumerPnpmOverrides } from "../init/consumer-overrides";

import {
  KNOWN_ATLAS_WEB_PLAYWRIGHT_SPECIFIERS,
  PLAYWRIGHT_TEST_PACKAGE,
  WEB_PLAYWRIGHT_PACKAGE_JSON,
} from "./playwright-pin";

import type { CapabilityDefinition, PackageManifestPatch } from "./types";

interface PackageJsonLike {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  pnpm?: { overrides?: Record<string, string> };
}

function readJsonObject(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

export function computeUiRestorePatch(
  canonicalUi: PackageJsonLike,
  scriptNames: string[]
): PackageManifestPatch {
  const scripts: Record<string, string> = {};
  for (const name of scriptNames) {
    const value = canonicalUi.scripts?.[name];
    if (value) {
      scripts[name] = value;
    }
  }

  const devDependencies: Record<string, string> = {};
  for (const [name, value] of Object.entries(canonicalUi.devDependencies ?? {})) {
    if (name === "husky") {
      continue;
    }
    if (shouldOmitConsumerUiDevDependency(name)) {
      const storybookRelated =
        name === "storybook" ||
        name.startsWith("@storybook/") ||
        name === "@playwright/test" ||
        name === "axe-playwright" ||
        name === "vite" ||
        name === "@tailwindcss/vite";
      if (storybookRelated) {
        devDependencies[name] = value;
      }
    }
  }

  return {
    path: "packages/ui/package.json",
    scripts: Object.keys(scripts).length > 0 ? scripts : undefined,
    devDependencies: Object.keys(devDependencies).length > 0 ? devDependencies : undefined,
  };
}

export function computeCapabilityPackagePatches(options: {
  capability: CapabilityDefinition;
  canonicalUi: PackageJsonLike;
  atlasOverrides: Record<string, string>;
}): PackageManifestPatch[] {
  const patches: PackageManifestPatch[] = [];

  if (
    options.capability.restoreUiScriptNames &&
    options.capability.restoreUiScriptNames.length > 0
  ) {
    const uiPatch = computeUiRestorePatch(
      options.canonicalUi,
      options.capability.restoreUiScriptNames
    );
    if (uiPatch.scripts || uiPatch.devDependencies) {
      patches.push(uiPatch);
    }
  }

  const rootScripts = options.capability.rootScripts;
  const rootDevDependencies = options.capability.rootDevDependencies;
  const dependencyNames = collectDependencyNames([
    { devDependencies: { ...rootDevDependencies, ...(options.canonicalUi.devDependencies ?? {}) } },
  ]);
  if (options.capability.id === "storybook") {
    dependencyNames.add("vite");
    dependencyNames.add("storybook");
  }
  const pnpmOverrides = selectConsumerPnpmOverrides(options.atlasOverrides, dependencyNames);
  const relevantOverrides: Record<string, string> = {};
  if (options.capability.id === "storybook" && pnpmOverrides.vite) {
    relevantOverrides.vite = pnpmOverrides.vite;
  }
  if (options.capability.id === "storybook" || options.capability.id === "visual") {
    const playwrightTest = options.canonicalUi.devDependencies?.["@playwright/test"];
    if (playwrightTest) {
      relevantOverrides[PLAYWRIGHT_TEST_PACKAGE] = playwrightTest;
      relevantOverrides.playwright = playwrightTest;
      patches.push({
        path: WEB_PLAYWRIGHT_PACKAGE_JSON,
        devDependencies: { [PLAYWRIGHT_TEST_PACKAGE]: playwrightTest },
        replaceableDevDependencies: {
          [PLAYWRIGHT_TEST_PACKAGE]: [...KNOWN_ATLAS_WEB_PLAYWRIGHT_SPECIFIERS],
        },
        statusMode: "conflicts-only",
      });
    }
  }

  if (rootScripts || rootDevDependencies || Object.keys(relevantOverrides).length > 0) {
    patches.push({
      path: "package.json",
      scripts: rootScripts,
      devDependencies: rootDevDependencies,
      pnpmOverrides: Object.keys(relevantOverrides).length > 0 ? relevantOverrides : undefined,
    });
  }

  return patches;
}

export function projectNameFromRepo(repoRoot: string): string {
  const packageJsonPath = path.join(repoRoot, "package.json");
  if (!existsSync(packageJsonPath)) {
    return path.basename(repoRoot);
  }
  const parsed = readJsonObject(packageJsonPath);
  return typeof parsed.name === "string" ? parsed.name : path.basename(repoRoot);
}

export function generatedFilesForCapability(options: {
  capabilityId: string;
  repoRoot: string;
  atlasVersion: string;
  runningCliVersion?: string;
}): { destination: string; content: string; isReplaceable?: (existing: string) => boolean }[] {
  const projectName = projectNameFromRepo(options.repoRoot);
  if (options.capabilityId === "docs") {
    return listGeneratedConsumerDocs({
      projectName,
      atlasVersion: options.atlasVersion,
      runningCliVersion: options.runningCliVersion,
    });
  }
  if (options.capabilityId === "cursor") {
    return listGeneratedCursorFiles({
      atlasVersion: options.atlasVersion,
      runningCliVersion: options.runningCliVersion,
    });
  }
  return [];
}

export type { PackageJsonLike };
