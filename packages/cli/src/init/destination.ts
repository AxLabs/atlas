import { existsSync, lstatSync, mkdirSync, readdirSync, realpathSync, rmdirSync } from "node:fs";
import path from "node:path";

import { CliError, CliErrorCode } from "../errors/cli-error";
import { resolveStartingDirectory } from "../project/find-root";

import { parseBootstrapProjectPath } from "./project-path";

export interface ResolvedBootstrapDestination {
  cwd: string;
  relativePath: string;
  absolutePath: string;
  existedEmpty: boolean;
}

function assertContained(root: string, candidate: string, label: string): void {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  if (
    resolvedCandidate !== resolvedRoot &&
    !resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`)
  ) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `${label} must stay inside ${resolvedRoot}. Received: ${candidate}`
    );
  }
}

function assertExistingAncestorContained(cwd: string, destination: string): void {
  let current = path.dirname(destination);
  while (current.startsWith(`${cwd}${path.sep}`) || current === cwd) {
    if (existsSync(current)) {
      const stats = lstatSync(current);
      if (stats.isSymbolicLink()) {
        throw new CliError(
          CliErrorCode.USAGE_ERROR,
          `Destination parent "${current}" is a symbolic link. Refusing to follow it.`
        );
      }
      if (!stats.isDirectory()) {
        throw new CliError(
          CliErrorCode.USAGE_ERROR,
          `Destination parent "${current}" is not a directory.`
        );
      }
      assertContained(cwd, realpathSync(current), "Destination parent");
      return;
    }
    if (current === cwd) {
      return;
    }
    current = path.dirname(current);
  }
}

export function isEmptyDirectory(directory: string): boolean {
  return readdirSync(directory).length === 0;
}

export function resolveBootstrapDestination(
  cwd: string | undefined,
  project: string
): ResolvedBootstrapDestination {
  const startDir = resolveStartingDirectory(cwd);
  const realCwd = realpathSync(startDir);
  const relativePath = parseBootstrapProjectPath(project);
  const absolutePath = path.resolve(realCwd, ...relativePath.split("/"));

  assertContained(realCwd, absolutePath, "Project destination");
  assertExistingAncestorContained(realCwd, absolutePath);

  if (!existsSync(absolutePath)) {
    return {
      cwd: realCwd,
      relativePath,
      absolutePath,
      existedEmpty: false,
    };
  }

  const stats = lstatSync(absolutePath);
  if (stats.isSymbolicLink()) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `Destination "${absolutePath}" is a symbolic link. Refusing to follow or overwrite it.`
    );
  }

  if (!stats.isDirectory()) {
    throw new CliError(
      CliErrorCode.BOOTSTRAP_CONFLICT,
      `Destination "${absolutePath}" already exists and is not an empty directory.`
    );
  }

  assertContained(realCwd, realpathSync(absolutePath), "Project destination");

  if (!isEmptyDirectory(absolutePath)) {
    throw new CliError(
      CliErrorCode.BOOTSTRAP_CONFLICT,
      `Destination "${absolutePath}" is not empty. atlas init will not merge into or overwrite an existing project. Choose a new directory or an empty folder.`
    );
  }

  return {
    cwd: realCwd,
    relativePath,
    absolutePath,
    existedEmpty: true,
  };
}

export function ensureDestinationParent(destination: string, cwd: string): string[] {
  const parent = path.dirname(destination);
  if (parent === destination) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `Unable to determine a parent directory for ${destination}.`
    );
  }

  const created: string[] = [];
  const missing: string[] = [];
  let current = parent;

  while (current.startsWith(`${cwd}${path.sep}`)) {
    if (existsSync(current)) {
      const stats = lstatSync(current);
      if (stats.isSymbolicLink()) {
        throw new CliError(
          CliErrorCode.USAGE_ERROR,
          `Destination parent "${current}" is a symbolic link. Refusing to follow it.`
        );
      }
      if (!stats.isDirectory()) {
        throw new CliError(
          CliErrorCode.USAGE_ERROR,
          `Destination parent "${current}" is not a directory.`
        );
      }
      break;
    }
    missing.push(current);
    current = path.dirname(current);
  }

  for (const directory of missing.reverse()) {
    mkdirSync(directory);
    created.push(directory);
  }

  return created;
}

export function removeEmptyDirectories(directories: string[]): void {
  for (const directory of [...directories].reverse()) {
    if (!existsSync(directory)) {
      continue;
    }
    if (isEmptyDirectory(directory)) {
      rmdirSync(directory);
    }
  }
}
