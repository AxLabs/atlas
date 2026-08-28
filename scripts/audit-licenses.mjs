import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertLicenseAuditArchitectures } from "./license-audit-config.mjs";
import {
  resolvePackageLicenseRecord,
  validateExceptionEntry,
  validateExceptions,
} from "./license-exceptions.mjs";
import { isAtlasWorkspacePackage, normalizeLicenseField } from "./license-policy.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

export const INVENTORY_SCHEMA_VERSION = "1";

export function loadExceptionsFile(root = repoRoot) {
  const filePath = path.join(root, "license-exceptions.json");
  if (!existsSync(filePath)) {
    return {};
  }

  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  return raw.exceptions ?? {};
}

function recordPackage(packageDir, packages) {
  const manifestPath = path.join(packageDir, "package.json");
  if (!existsSync(manifestPath)) {
    return;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!manifest.name || isAtlasWorkspacePackage(manifest.name)) {
    return;
  }

  const version = manifest.version ?? "0.0.0";
  const key = `${manifest.name}@${version}`;
  if (packages.has(key)) {
    return;
  }

  packages.set(key, {
    name: manifest.name,
    version,
    license: normalizeLicenseField(manifest.license, manifest.licenses),
    repository: manifest.repository,
    path: packageDir,
  });
}

function walkNodeModules(dir, packages) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.name.startsWith("@")) {
      for (const scoped of readdirSync(fullPath, { withFileTypes: true })) {
        if (scoped.isDirectory() && !scoped.name.startsWith(".")) {
          recordPackage(path.join(fullPath, scoped.name), packages);
        }
      }
      continue;
    }

    recordPackage(fullPath, packages);
  }
}

/**
 * Enumerate third-party packages from node_modules after a frozen install.
 * The audit universe is all packages materialized by pnpm for the
 * supportedArchitectures declared in pnpm-workspace.yaml (linux + darwin,
 * x64 + arm64), not only packages for the current host OS.
 */
export function enumerateInstalledPackages(root = repoRoot) {
  const nodeModulesRoot = path.join(root, "node_modules");
  if (!existsSync(nodeModulesRoot)) {
    throw new Error("node_modules not found; run pnpm install --frozen-lockfile");
  }

  const packages = new Map();
  const pnpmDir = path.join(nodeModulesRoot, ".pnpm");

  if (existsSync(pnpmDir)) {
    for (const entry of readdirSync(pnpmDir)) {
      if (entry === "lock.yaml") {
        continue;
      }

      const virtualNodeModules = path.join(pnpmDir, entry, "node_modules");
      if (existsSync(virtualNodeModules)) {
        walkNodeModules(virtualNodeModules, packages);
      }
    }
  }

  if (packages.size === 0) {
    walkNodeModules(nodeModulesRoot, packages);
  }

  return [...packages.values()].sort((a, b) =>
    a.name === b.name ? a.version.localeCompare(b.version) : a.name.localeCompare(b.name),
  );
}

export function buildInventoryRecords(packages, exceptions) {
  const records = [];

  for (const pkg of packages) {
    const key = `${pkg.name}@${pkg.version}`;
    const exception = exceptions[key];
    const entryErrors = exception
      ? validateExceptionEntry(key, exception, { package: pkg })
      : [];
    records.push(resolvePackageLicenseRecord(pkg, exception, entryErrors));
  }

  return records.sort(
    (left, right) =>
      left.name === right.name
        ? left.version.localeCompare(right.version)
        : left.name.localeCompare(right.name),
  );
}

export function summarizeInventory(records) {
  const summary = {
    allowed: [],
    "review-required": [],
    disallowed: [],
    unknown: [],
    reviewed: [],
  };

  for (const record of records) {
    if (record.disposition === "accepted") {
      summary.reviewed.push(record);
      continue;
    }

    summary[record.declaredClassification].push(record);
  }

  return summary;
}

export function summarizePackages(packages, exceptions) {
  return summarizeInventory(buildInventoryRecords(packages, exceptions));
}

function formatLicenseRecordLine(record) {
  const lines = [`  ${record.name}@${record.version}`];
  lines.push(`    declared=${record.declaredLicense ?? "none"}`);
  lines.push(`    classification=${record.declaredClassification}`);

  if (record.effectiveLicense != null) {
    lines.push(`    effective=${record.effectiveLicense}`);
  }

  if (record.effectiveClassification != null) {
    lines.push(`    effectiveClassification=${record.effectiveClassification}`);
  }

  if (record.disposition) {
    lines.push(`    disposition=${record.disposition}`);
  }

  return lines.join("\n");
}

function printReport(records, summary) {
  console.log(
    "Dependency license inventory (supportedArchitectures universe, excluding @atlas/*)\n",
  );

  for (const record of records) {
    console.log(formatLicenseRecordLine(record));
  }

  console.log("");
  console.log(`  allowed:          ${summary.allowed.length}`);
  console.log(`  review-required:  ${summary["review-required"].length}`);
  console.log(`  unknown:          ${summary.unknown.length}`);
  console.log(`  disallowed:       ${summary.disallowed.length}`);
  console.log(`  reviewed/accepted: ${summary.reviewed.length}`);
}

function printCheckSummary(summary) {
  console.log("Dependency license audit");
  console.log(`  allowed: ${summary.allowed.length}`);
  console.log(`  reviewed/accepted: ${summary.reviewed.length}`);
  console.log(`  review-required unresolved: ${summary["review-required"].length}`);
  console.log(`  unknown: ${summary.unknown.length}`);
  console.log(`  disallowed: ${summary.disallowed.length}`);
}

function printBlockingRecords(records) {
  const blocking = records.filter(
    (record) =>
      record.declaredClassification === "disallowed" ||
      (record.declaredClassification === "unknown" && record.disposition !== "accepted") ||
      (record.declaredClassification === "review-required" && record.disposition !== "accepted"),
  );

  if (blocking.length === 0) {
    return;
  }

  console.error("\nBlocking dependency license records:\n");
  for (const record of blocking) {
    console.error(formatLicenseRecordLine(record));
    console.error("");
  }
}

export function buildJsonReport({ root = repoRoot, packages, exceptions, records, summary } = {}) {
  const architectures = assertLicenseAuditArchitectures(root);

  return {
    schemaVersion: INVENTORY_SCHEMA_VERSION,
    auditUniverse: {
      source: "node_modules package.json manifests",
      supportedArchitectures: architectures,
      note: "Frozen install materializes optional platform packages for all supportedArchitectures in pnpm-workspace.yaml",
    },
    packageCount: records.length,
    summary: {
      allowed: summary.allowed.length,
      "review-required": summary["review-required"].length,
      unknown: summary.unknown.length,
      disallowed: summary.disallowed.length,
      reviewed: summary.reviewed.length,
    },
    packages: records.map((record) => ({
      name: record.name,
      version: record.version,
      declaredLicense: record.declaredLicense,
      declaredClassification: record.declaredClassification,
      ...(record.effectiveLicense != null ? { effectiveLicense: record.effectiveLicense } : {}),
      ...(record.effectiveClassification != null
        ? { effectiveClassification: record.effectiveClassification }
        : {}),
      ...(record.disposition ? { disposition: record.disposition } : {}),
      ...(record.exception ? { exception: record.exception } : {}),
    })),
    exceptions: Object.keys(exceptions).sort(),
    packagesEnumerated: packages.map((pkg) => `${pkg.name}@${pkg.version}`),
  };
}

export function runLicenseAudit({ root = repoRoot, reportOnly = false } = {}) {
  assertLicenseAuditArchitectures(root);

  if (!existsSync(path.join(root, "node_modules"))) {
    throw new Error("Run pnpm install --frozen-lockfile before pnpm licenses:check");
  }

  const packages = enumerateInstalledPackages(root);
  const packagesByKey = new Map(packages.map((pkg) => [`${pkg.name}@${pkg.version}`, pkg]));
  const exceptions = loadExceptionsFile(root);
  const exceptionErrors = validateExceptions(exceptions, packagesByKey, { repoRoot: root });
  const records = buildInventoryRecords(packages, exceptions);
  const summary = summarizeInventory(records);

  return {
    packages,
    packagesByKey,
    exceptions,
    exceptionErrors,
    records,
    summary,
    reportOnly,
  };
}

function main() {
  const reportOnly = process.argv.includes("--report");
  const jsonOutput = process.argv.includes("--json");
  const audit = runLicenseAudit({ reportOnly });

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        buildJsonReport({
          root: repoRoot,
          packages: audit.packages,
          exceptions: audit.exceptions,
          records: audit.records,
          summary: audit.summary,
        }),
        null,
        2,
      ),
    );
    return;
  }

  if (reportOnly) {
    printReport(audit.records, audit.summary);
    return;
  }

  const errors = [...audit.exceptionErrors];

  if (audit.summary.disallowed.length > 0) {
    errors.push(`${audit.summary.disallowed.length} dependency license(s) are disallowed by policy`);
  }

  if (audit.summary.unknown.length > 0) {
    errors.push(`${audit.summary.unknown.length} dependency license(s) are unknown to policy`);
  }

  if (audit.summary["review-required"].length > 0) {
    errors.push(
      `${audit.summary["review-required"].length} review-required dependency license(s) lack an accepted exception`,
    );
  }

  if (errors.length > 0) {
    printCheckSummary(audit.summary);
    printBlockingRecords(audit.records);
    console.error("\nDependency license check failed:\n");
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  printCheckSummary(audit.summary);
  console.log("\n✓ Dependency license policy checks passed");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
