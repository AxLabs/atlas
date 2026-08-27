import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { minimatch } from "minimatch";
import { parse as parseYaml } from "yaml";

const WORKSPACE_DISCOVERY_IGNORED_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "coverage",
  ".turbo",
  ".git",
  "storybook-static",
  "playwright-report",
  "test-results",
]);

export interface ParsedWorkspaceConfig {
  patterns: string[];
}

export function parsePnpmWorkspaceFile(contents: string): ParsedWorkspaceConfig {
  const parsed = parseYaml(contents) as { packages?: unknown };
  const packages = parsed?.packages;

  if (!Array.isArray(packages)) {
    return { patterns: [] };
  }

  return {
    patterns: packages.filter((entry): entry is string => typeof entry === "string"),
  };
}

export function readPnpmWorkspacePatterns(workspaceFilePath: string): ParsedWorkspaceConfig {
  return parsePnpmWorkspaceFile(readFileSync(workspaceFilePath, "utf8"));
}

export function isWorkspaceRootIncluded(patterns: string[], relativeRoot: string): boolean {
  const normalized = relativeRoot.replace(/\\/g, "/");
  let matched = false;

  for (const pattern of patterns) {
    if (pattern.startsWith("!")) {
      continue;
    }

    if (minimatch(normalized, pattern, { dot: true })) {
      matched = true;
      break;
    }
  }

  if (!matched) {
    return false;
  }

  for (const pattern of patterns) {
    if (!pattern.startsWith("!")) {
      continue;
    }

    const negatedPattern = pattern.slice(1);
    if (minimatch(normalized, negatedPattern, { dot: true })) {
      return false;
    }
  }

  return true;
}

export function discoverWorkspaceRoots(repoRoot: string): string[] {
  const workspaceFile = path.join(repoRoot, "pnpm-workspace.yaml");
  if (!existsSync(workspaceFile)) {
    return [];
  }

  const { patterns } = readPnpmWorkspacePatterns(workspaceFile);
  const roots: string[] = [];

  function walk(currentAbsolute: string, relativePath: string): void {
    for (const entry of readdirSync(currentAbsolute)) {
      if (WORKSPACE_DISCOVERY_IGNORED_DIRS.has(entry)) {
        continue;
      }

      const absolutePath = path.join(currentAbsolute, entry);
      const stats = statSync(absolutePath);
      if (!stats.isDirectory()) {
        continue;
      }

      const posixRelative = relativePath ? `${relativePath}/${entry}` : entry;
      const manifestPath = path.join(absolutePath, "package.json");

      if (existsSync(manifestPath)) {
        if (isWorkspaceRootIncluded(patterns, posixRelative)) {
          roots.push(posixRelative);
        }
        continue;
      }

      walk(absolutePath, posixRelative);
    }
  }

  walk(repoRoot, "");
  return [...new Set(roots)].sort();
}
