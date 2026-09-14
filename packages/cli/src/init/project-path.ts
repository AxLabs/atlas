import path from "node:path";

import { CliError, CliErrorCode } from "../errors/cli-error";

const PROJECT_SEGMENT_PATTERN = /^[a-z][a-z0-9-]*$/;
const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:[\\/]/;

/**
 * Validate `atlas init <project>` destination input.
 * Returns a normalized relative POSIX path with kebab-case segments.
 */
export function parseBootstrapProjectPath(raw: string): string {
  if (typeof raw !== "string" || raw.length === 0) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      "Project path must be a non-empty relative path (example: my-app)."
    );
  }

  if (raw !== raw.trim()) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `Project path must not include leading or trailing whitespace (${raw}).`
    );
  }

  if (raw.includes("\0")) {
    throw new CliError(CliErrorCode.USAGE_ERROR, "Project path must not contain a null byte.");
  }

  if (raw.includes("\\")) {
    throw new CliError(CliErrorCode.USAGE_ERROR, `Project path must use forward slashes (${raw}).`);
  }

  if (path.posix.isAbsolute(raw) || raw.startsWith("/") || WINDOWS_ABSOLUTE_PATH.test(raw)) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `Project path must be relative to the current working directory (${raw}).`
    );
  }

  if (raw.includes("://") || raw.startsWith("~")) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `Project path is not a safe relative path (${raw}).`
    );
  }

  if (raw === "." || raw === "..") {
    throw new CliError(CliErrorCode.USAGE_ERROR, `Invalid project path: ${raw}`);
  }

  const segments = raw.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `Project path must not contain empty, ".", or ".." segments (${raw}).`
    );
  }

  for (const segment of segments) {
    if (!PROJECT_SEGMENT_PATTERN.test(segment)) {
      throw new CliError(
        CliErrorCode.USAGE_ERROR,
        `Project path segments must use kebab-case (example: my-app or nested/my-app). Received: ${raw}`
      );
    }
  }

  return segments.join("/");
}

export function bootstrapProjectName(relativePath: string): string {
  const segments = relativePath.split("/");
  const last = segments[segments.length - 1];
  if (!last) {
    throw new CliError(CliErrorCode.USAGE_ERROR, "Project path must include a directory name.");
  }
  return last;
}
