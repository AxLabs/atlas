import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { CliError, CliErrorCode } from "../errors/cli-error";

import type { CommandWarning } from "../types/result";

interface EngineRequirement {
  name: "node" | "pnpm";
  minimum: string;
}

interface ParsedEngine {
  node?: string;
  pnpm?: string;
}

function readEngineRequirements(repoRoot: string): ParsedEngine {
  const packageJsonPath = path.join(repoRoot, "package.json");
  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    engines?: { node?: string; pnpm?: string };
  };

  return {
    node: parsed.engines?.node,
    pnpm: parsed.engines?.pnpm,
  };
}

function isValidSemverComponent(value: string): boolean {
  if (value.length === 0) {
    return false;
  }

  for (const character of value) {
    if (character < "0" || character > "9") {
      return false;
    }
  }

  return true;
}

function parseMinimumVersion(requirement: string): string {
  if (!requirement.startsWith(">=")) {
    throw new Error(`Unsupported engine requirement format: ${requirement}`);
  }

  const minimum = requirement.slice(2).trim();
  const parts = minimum.split(".");

  if (parts.length === 0 || parts.some((part) => !isValidSemverComponent(part))) {
    throw new Error(`Unsupported engine requirement format: ${requirement}`);
  }

  return minimum;
}

function parseVersionParts(value: string): number[] {
  return value
    .replace(/^v/, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10));
}

function isAtLeast(actual: string, minimum: string): boolean {
  const actualParts = parseVersionParts(actual);
  const minimumParts = parseVersionParts(minimum);
  const length = Math.max(actualParts.length, minimumParts.length);

  for (let index = 0; index < length; index += 1) {
    const actualPart = actualParts[index] ?? 0;
    const minimumPart = minimumParts[index] ?? 0;

    if (actualPart > minimumPart) {
      return true;
    }

    if (actualPart < minimumPart) {
      return false;
    }
  }

  return true;
}

function readNodeVersion(): string {
  return process.versions.node;
}

function readPnpmVersion(): string | null {
  try {
    const output = execSync("pnpm --version", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    return output.length > 0 ? output : null;
  } catch {
    return null;
  }
}

function validateEngine(requirement: EngineRequirement, detected: string | null): CliError | null {
  if (!detected) {
    return new CliError(
      CliErrorCode.PREREQUISITE_ERROR,
      `Atlas requires ${requirement.name} ${requirement.minimum}.\nDetected: not available`
    );
  }

  if (!isAtLeast(detected, requirement.minimum)) {
    return new CliError(
      CliErrorCode.PREREQUISITE_ERROR,
      `Atlas requires ${requirement.name} >=${requirement.minimum}.\nDetected: ${detected}`
    );
  }

  return null;
}

export function validatePrerequisites(repoRoot: string): CommandWarning[] {
  const engines = readEngineRequirements(repoRoot);
  const warnings: CommandWarning[] = [];

  if (engines.node) {
    const minimum = parseMinimumVersion(engines.node);
    const detected = readNodeVersion();
    const error = validateEngine({ name: "node", minimum }, detected);
    if (error) {
      throw error;
    }
  }

  if (engines.pnpm) {
    const minimum = parseMinimumVersion(engines.pnpm);
    const detected = readPnpmVersion();
    const error = validateEngine({ name: "pnpm", minimum }, detected);
    if (error) {
      throw error;
    }
  } else {
    warnings.push({
      code: "PNPM_ENGINE_UNSPECIFIED",
      message: "No pnpm engine requirement found in package.json; skipping pnpm validation.",
    });
  }

  return warnings;
}
