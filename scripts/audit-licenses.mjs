import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertLicenseAuditArchitectures } from "./license-audit-config.mjs";
import { validateExceptions } from "./license-exceptions.mjs";
import {
  classifyLicenseExpression,
  isAtlasWorkspacePackage,
  normalizeLicenseField,
} from "./license-policy.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const exceptionsPath = path.join(repoRoot, "license-exceptions.json");

const FORBIDDEN_SOURCE_PATTERNS = [
  /^git\+/i,
  /^github:/i,
  /^file:\/\//i,
  /^file:\.\./,
  /^link:/i,
  /^workspace:/i,
];

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

  // Atlas uses node-linker=hoisted; most packages resolve directly under node_modules/.
  if (packages.size === 0) {
    walkNodeModules(nodeModulesRoot, packages);
  }

  return [...packages.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function checkPrivatePackageSources(packages) {
  const findings = [];

  for (const pkg of packages) {
    const manifest = JSON.parse(readFileSync(path.join(pkg.path, "package.json"), "utf8"));
    const sections = [
      manifest.dependencies,
      manifest.optionalDependencies,
      manifest.peerDependencies,
    ];

    for (const section of sections) {
      if (!section) {
        continue;
      }

      for (const [name, spec] of Object.entries(section)) {
        if (FORBIDDEN_SOURCE_PATTERNS.some((pattern) => pattern.test(spec))) {
          findings.push(`${name}@${pkg.version} declares non-registry source "${spec}"`);
        }
      }
    }

    if (manifest.private === true && !isAtlasWorkspacePackage(pkg.name)) {
      findings.push(`${pkg.name}@${pkg.version} is marked private in its manifest`);
    }
  }

  return findings;
}

export function summarizePackages(packages, exceptions) {
  const summary = {
    allowed: [],
    "review-required": [],
    disallowed: [],
    unknown: [],
    reviewed: [],
  };

  for (const pkg of packages) {
    const key = `${pkg.name}@${pkg.version}`;
    const exception = exceptions[key];
    const declaredStatus = classifyLicenseExpression(pkg.license);

    if (exception) {
      summary.reviewed.push({
        ...pkg,
        declaredStatus,
        disposition: exception.status,
        effectiveLicense: exception.effectiveLicense,
        reason: exception.reason,
        reviewedOn: exception.reviewedOn,
      });
      continue;
    }

    summary[declaredStatus].push(pkg);
  }

  return summary;
}

function printReport(summary) {
  console.log("Dependency license inventory (installed packages, excluding @atlas/*)\n");
  console.log(`  allowed:          ${summary.allowed.length}`);
  console.log(`  review-required:  ${summary["review-required"].length}`);
  console.log(`  unknown:          ${summary.unknown.length}`);
  console.log(`  disallowed:       ${summary.disallowed.length}`);
  console.log(`  reviewed except.: ${summary.reviewed.length}`);

  const blockers = [
    ...summary.disallowed,
    ...summary.unknown,
    ...summary["review-required"],
  ];

  if (blockers.length > 0) {
    console.error("\nPackages requiring disposition:\n");
    for (const pkg of blockers) {
      console.error(
        `  - ${pkg.name}@${pkg.version} license=${pkg.license ?? "none"} status=${classifyLicenseExpression(pkg.license)}`,
      );
    }
  }

  if (summary.reviewed.length > 0) {
    console.log("\nReviewed exceptions:\n");
    for (const pkg of summary.reviewed) {
      const effective = pkg.effectiveLicense ? ` effective=${pkg.effectiveLicense}` : "";
      console.log(
        `  - ${pkg.name}@${pkg.version} declared=${pkg.license ?? "none"} status=${pkg.declaredStatus} reviewed=${pkg.disposition}${effective}`,
      );
    }
  }
}

export function runLicenseAudit({ root = repoRoot, reportOnly = false } = {}) {
  assertLicenseAuditArchitectures(root);

  if (!existsSync(path.join(root, "node_modules"))) {
    throw new Error("Run pnpm install --frozen-lockfile before pnpm licenses:check");
  }

  const packages = enumerateInstalledPackages(root);
  const packagesByKey = new Map(packages.map((pkg) => [`${pkg.name}@${pkg.version}`, pkg]));
  const exceptions = loadExceptionsFile(root);
  const exceptionErrors = validateExceptions(exceptions, packagesByKey);
  const summary = summarizePackages(packages, exceptions);
  const privateSourceFindings = checkPrivatePackageSources(packages);

  return {
    packages,
    packagesByKey,
    exceptions,
    exceptionErrors,
    summary,
    privateSourceFindings,
    reportOnly,
  };
}

function main() {
  const reportOnly = process.argv.includes("--report");
  const audit = runLicenseAudit({ reportOnly });

  printReport(audit.summary);

  if (reportOnly) {
    return;
  }

  const errors = [...audit.privateSourceFindings, ...audit.exceptionErrors];

  if (audit.summary.disallowed.length > 0) {
    errors.push(`${audit.summary.disallowed.length} dependency license(s) are disallowed by policy`);
  }

  if (audit.summary.unknown.length > 0) {
    errors.push(`${audit.summary.unknown.length} dependency license(s) are unknown to policy`);
  }

  const unresolvedReview = audit.summary["review-required"].filter(
    (pkg) => !audit.exceptions[`${pkg.name}@${pkg.version}`],
  );
  if (unresolvedReview.length > 0) {
    errors.push(
      `${unresolvedReview.length} review-required dependency license(s) lack an entry in license-exceptions.json`,
    );
  }

  if (errors.length > 0) {
    console.error("\nDependency license check failed:\n");
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log("\n✓ Dependency license policy checks passed");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
