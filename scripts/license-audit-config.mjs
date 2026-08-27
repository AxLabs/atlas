import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const workspaceConfigPath = path.join(repoRoot, "pnpm-workspace.yaml");

/** Atlas-supported OS/CPU combinations for dependency license auditing. */
export const EXPECTED_LICENSE_AUDIT_OS = ["darwin", "linux"];
export const EXPECTED_LICENSE_AUDIT_CPU = ["arm64", "x64"];

function parseArchitectureList(yaml, sectionKey) {
  const sectionPattern = new RegExp(
    `^supportedArchitectures:\\s*\\n(?:[^\\n]*\\n)*?  ${sectionKey}:\\s*\\n((?:    - [^\\n]+\\n)+)`,
    "m",
  );
  const match = yaml.match(sectionPattern);
  if (!match) {
    return [];
  }

  return [...match[1].matchAll(/^    - (.+)$/gm)].map((entry) => entry[1].trim());
}

/**
 * Read supportedArchitectures from pnpm-workspace.yaml — the single source of truth
 * for which optional platform packages are materialized during `pnpm install`.
 */
export function readLicenseAuditArchitectures(root = repoRoot) {
  const yaml = readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8");
  const os = parseArchitectureList(yaml, "os");
  const cpu = parseArchitectureList(yaml, "cpu");

  if (os.length === 0 || cpu.length === 0) {
    throw new Error(
      "pnpm-workspace.yaml must define supportedArchitectures with at least one os and one cpu",
    );
  }

  if (os.includes("current")) {
    throw new Error(
      'supportedArchitectures.os must not include "current"; use explicit OS values for deterministic auditing',
    );
  }

  return { os, cpu };
}

export function assertLicenseAuditArchitectures(root = repoRoot) {
  const { os, cpu } = readLicenseAuditArchitectures(root);

  const sortedOs = [...os].sort();
  const sortedCpu = [...cpu].sort();
  const expectedOs = [...EXPECTED_LICENSE_AUDIT_OS].sort();
  const expectedCpu = [...EXPECTED_LICENSE_AUDIT_CPU].sort();

  if (sortedOs.join(",") !== expectedOs.join(",")) {
    throw new Error(
      `supportedArchitectures.os must be ${expectedOs.join(", ")} (found: ${os.join(", ")})`,
    );
  }

  if (sortedCpu.join(",") !== expectedCpu.join(",")) {
    throw new Error(
      `supportedArchitectures.cpu must be ${expectedCpu.join(", ")} (found: ${cpu.join(", ")})`,
    );
  }

  return { os, cpu };
}
