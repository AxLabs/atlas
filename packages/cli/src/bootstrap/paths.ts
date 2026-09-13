import path from "node:path";

import { BootstrapAssetError } from "./errors";

const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:[\\/]/;

export function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

/** Normalize a manifest path to POSIX form without `.` or `..` segments. */
export function normalizeManifestPath(value: string, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BootstrapAssetError(`${label} must be a non-empty relative POSIX path.`);
  }

  if (value.includes("\0")) {
    throw new BootstrapAssetError(`${label} must not contain a null byte (${value}).`);
  }

  const posix = toPosixPath(value);

  if (path.posix.isAbsolute(posix) || posix.startsWith("/") || WINDOWS_ABSOLUTE_PATH.test(value)) {
    throw new BootstrapAssetError(`${label} must not be an absolute path (${value}).`);
  }

  if (posix.includes("://")) {
    throw new BootstrapAssetError(`${label} must not be a URL (${value}).`);
  }

  const trimmed = posix.replace(/^\.\/+/, "").replace(/\/+$/, "");
  if (trimmed.length === 0) {
    throw new BootstrapAssetError(`${label} must not be empty or "." (${value}).`);
  }

  const segments = trimmed.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw new BootstrapAssetError(
      `${label} must not contain empty, ".", or ".." segments (${value}).`
    );
  }

  const normalized = path.posix.normalize(trimmed);
  if (normalized !== trimmed) {
    throw new BootstrapAssetError(`${label} must already be a normalized POSIX path (${value}).`);
  }

  if (normalized.startsWith("../") || normalized === "..") {
    throw new BootstrapAssetError(`${label} must not escape the project root (${value}).`);
  }

  return normalized;
}

export function normalizeGlobPattern(value: string, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BootstrapAssetError(`${label} must be a non-empty glob pattern.`);
  }

  if (value.includes("\0")) {
    throw new BootstrapAssetError(`${label} must not contain a null byte (${value}).`);
  }

  const posix = toPosixPath(value);
  if (path.posix.isAbsolute(posix) || posix.startsWith("/") || WINDOWS_ABSOLUTE_PATH.test(value)) {
    throw new BootstrapAssetError(`${label} must not be an absolute glob (${value}).`);
  }

  const trimmed = posix.replace(/^\.\/+/, "").replace(/\/+$/, "");
  if (trimmed.length === 0) {
    throw new BootstrapAssetError(`${label} must not be empty (${value}).`);
  }

  const segments = trimmed.split("/");
  if (segments.some((segment) => segment === ".." || segment.length === 0)) {
    throw new BootstrapAssetError(`${label} must not contain empty or ".." segments (${value}).`);
  }

  return trimmed;
}

export function joinPosix(...parts: string[]): string {
  return parts.filter((part) => part.length > 0).join("/");
}

export function comparePosixPaths(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

export function resolveContainedPath(
  root: string,
  relativePosixPath: string,
  label: string
): string {
  const normalized = normalizeManifestPath(relativePosixPath, label);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...normalized.split("/"));

  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new BootstrapAssetError(
      `${label} resolves outside ${resolvedRoot} (${relativePosixPath}).`
    );
  }

  return resolved;
}

export function assertNoDestinationPrefixConflicts(destinations: string[]): void {
  const sorted = [...destinations].sort(comparePosixPaths);
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];
    if (current === undefined || next === undefined) {
      continue;
    }
    if (next.startsWith(`${current}/`)) {
      throw new BootstrapAssetError(
        `Destination "${current}" conflicts with nested destination "${next}".`
      );
    }
  }
}
