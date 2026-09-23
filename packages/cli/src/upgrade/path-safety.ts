import path from "node:path";

import { joinRepoPath } from "@atlas/project";

import { CliError, CliErrorCode } from "../errors/cli-error";

export function validateReleaseRelativePath(relativePath: string, context: string): void {
  validateRelativePath(relativePath, context);

  const normalized = path.posix.normalize(relativePath.replace(/\\/g, "/"));
  if (normalized === "." || normalized === "") {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `${context}: path must not be empty or "." (${relativePath}).`
    );
  }
}

export function validateReleaseApplicationPath(applicationPath: string, context: string): void {
  validateReleaseRelativePath(applicationPath, context);
}

export function validateReleaseOpenApiPath(relativePath: string, context: string): void {
  validateReleaseRelativePath(relativePath, context);
}

function validateRelativePath(relativePath: string, context: string): void {
  if (relativePath.startsWith("/")) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `${context}: absolute paths are not allowed (${relativePath}).`
    );
  }

  if (/^[A-Za-z]:/.test(relativePath)) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `${context}: absolute paths are not allowed (${relativePath}).`
    );
  }

  if (relativePath.includes("..")) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `${context}: path traversal is not allowed (${relativePath}).`
    );
  }

  const normalized = path.posix.normalize(relativePath.replace(/\\/g, "/"));
  if (normalized.startsWith("../") || normalized === "..") {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `${context}: path resolves outside the allowed root (${relativePath}).`
    );
  }

  const segments = normalized.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw new CliError(
      CliErrorCode.UPGRADE_PREREQUISITE,
      `${context}: path contains empty segments (${relativePath}).`
    );
  }
}

export function resolvePathUnderRoot(root: string, relativePath: string, context: string): string {
  try {
    return joinRepoPath(root, relativePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(CliErrorCode.UPGRADE_PREREQUISITE, `${context}: ${message}`);
  }
}

export function resolvePathUnderReleaseRoot(
  releaseRoot: string,
  relativePath: string,
  context: string
): string {
  validateReleaseRelativePath(relativePath, context);
  return resolvePathUnderRoot(releaseRoot, relativePath, context);
}

export function resolvePathUnderApplicationRoot(
  applicationRoot: string,
  relativePath: string,
  context: string
): string {
  validateReleaseRelativePath(relativePath, context);
  return resolvePathUnderRoot(applicationRoot, relativePath, context);
}

export function assertNoPathListDuplicates(paths: string[], listName: string): void {
  const seen = new Set<string>();
  for (const entry of paths) {
    if (seen.has(entry)) {
      throw new CliError(
        CliErrorCode.UPGRADE_PREREQUISITE,
        `Release snapshot ${listName} contains duplicate path "${entry}".`
      );
    }
    seen.add(entry);
  }
}

export function assertNoReleasePathOverlap(manifest: {
  syncedPaths: string[];
  generatedPaths: string[];
  independentPaths: string[];
}): void {
  const ownership = new Map<string, string>();

  const recordOwnership = (relativePath: string, category: string): void => {
    const existing = ownership.get(relativePath);
    if (existing) {
      throw new CliError(
        CliErrorCode.UPGRADE_PREREQUISITE,
        `Release snapshot path "${relativePath}" is classified as both ${existing} and ${category}.`
      );
    }
    ownership.set(relativePath, category);
  };

  for (const syncedPath of manifest.syncedPaths) {
    recordOwnership(syncedPath, "syncedPaths");
  }

  for (const generatedPath of manifest.generatedPaths) {
    recordOwnership(generatedPath, "generatedPaths");
  }

  for (const independentPath of manifest.independentPaths) {
    recordOwnership(independentPath, "independentPaths");
  }
}
