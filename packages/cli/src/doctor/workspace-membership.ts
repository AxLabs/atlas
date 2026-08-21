import { readFileSync } from "node:fs";

import { minimatch } from "minimatch";
import { parse as parseYaml } from "yaml";

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
