import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readJson } from "./atlas-workspaces.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const require = createRequire(import.meta.url);

function loadDependencyValidation() {
  try {
    return require("@atlas/cli/dependency-validation");
  } catch {
    execSync("pnpm --filter @atlas/cli build", {
      cwd: repoRoot,
      stdio: "inherit",
    });
    return require("@atlas/cli/dependency-validation");
  }
}

const {
  discoverWorkspaceRoots,
  findUndeclaredDependenciesForAllWorkspaces,
} = loadDependencyValidation();

const errors = [];

function fail(message) {
  errors.push(message);
}

/** Packages that must resolve to one version when declared in multiple workspaces */
const ALIGNED_PACKAGES = [
  "@hookform/resolvers",
  "zod",
  "msw",
  "react-hook-form",
  "react",
  "react-dom",
];

const LOCKFILE_SUSPICIOUS_SOURCE = /(?:git\+|github:.*\/|file:\/|file:\.\.)/;

function listDependencySections(pkg) {
  return {
    dependencies: pkg.dependencies ?? {},
    devDependencies: pkg.devDependencies ?? {},
    peerDependencies: pkg.peerDependencies ?? {},
  };
}

function collectDeclaredVersions(workspaceRelativePath) {
  const pkgPath = path.join(workspaceRelativePath, "package.json");
  const pkg = readJson(pkgPath, repoRoot);
  const versions = {};

  for (const [sectionName, section] of Object.entries(listDependencySections(pkg))) {
    if (sectionName === "peerDependencies") {
      continue;
    }
    for (const [name, range] of Object.entries(section)) {
      if (name.startsWith("@atlas/") || range === "workspace:*") {
        continue;
      }
      versions[name] ??= [];
      versions[name].push({ workspace: pkg.name, section: sectionName, range });
    }
  }

  return versions;
}

function checkGenericWorkspaceOwnership() {
  const workspaceRoots = discoverWorkspaceRoots(repoRoot);
  if (workspaceRoots.length === 0) {
    fail("No workspace roots discovered from pnpm-workspace.yaml.");
    return;
  }

  const findings = findUndeclaredDependenciesForAllWorkspaces(repoRoot, {
    scanMode: "repository",
  });

  for (const finding of findings) {
    fail(
      `workspace: ${finding.workspaceRoot}; package: ${finding.packageName}; file: ${finding.filePath}:${finding.line}`,
    );
  }
}

function checkAlignedVersions(workspaceRoots) {
  const byPackage = new Map();

  for (const workspaceRoot of workspaceRoots) {
    const versions = collectDeclaredVersions(workspaceRoot);
    for (const [name, entries] of Object.entries(versions)) {
      if (!ALIGNED_PACKAGES.includes(name)) {
        continue;
      }
      byPackage.set(name, [...(byPackage.get(name) ?? []), ...entries]);
    }
  }

  for (const [packageName, entries] of byPackage) {
    const uniqueRanges = [...new Set(entries.map((e) => e.range))];
    if (uniqueRanges.length > 1) {
      const detail = entries.map((e) => `${e.workspace} (${e.section}): ${e.range}`).join("; ");
      fail(
        `Version skew for ${packageName}: ${detail}. Align ranges or document intentional divergence in docs/how-we-build/dependencies.md`,
      );
    }
  }
}

function checkLockfileSources() {
  const lockPath = path.join(repoRoot, "pnpm-lock.yaml");
  if (!statSync(lockPath).isFile()) {
    fail("Missing pnpm-lock.yaml");
    return;
  }

  const lockfile = readFileSync(lockPath, "utf8");
  const lines = lockfile.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!LOCKFILE_SUSPICIOUS_SOURCE.test(line)) {
      continue;
    }
    if (line.includes("workspace:")) {
      continue;
    }
    fail(`Suspicious package source in pnpm-lock.yaml line ${i + 1}: ${line.trim()}`);
  }
}

function checkStaleUiPackages() {
  const uiPkg = readJson("packages/ui/package.json", repoRoot);
  const stale = ["vaul", "@radix-ui/"];

  for (const section of Object.values(listDependencySections(uiPkg))) {
    for (const name of Object.keys(section)) {
      if (stale.some((prefix) => name === prefix || name.startsWith(prefix))) {
        fail(
          `${name} is declared in @atlas/ui but Atlas UI uses Base UI primitives. Remove stale declaration.`,
        );
      }
    }
  }
}

function checkAppStylingDuplicates() {
  const stylingPackages = [
    "clsx",
    "tailwind-merge",
    "class-variance-authority",
    "tailwindcss-animate",
  ];

  for (const appRoot of ["apps/web", "apps/reference"]) {
    const pkg = readJson(path.join(appRoot, "package.json"), repoRoot);
    const declared = new Set([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ]);

    for (const stylingPkg of stylingPackages) {
      if (declared.has(stylingPkg)) {
        fail(
          `${pkg.name} declares ${stylingPkg} but apps consume styling via @atlas/ui (cn, globals.css). Remove duplicate declaration.`,
        );
      }
    }
  }
}

function checkHookformResolverOwnership() {
  for (const appRoot of ["apps/web", "apps/reference"]) {
    const pkg = readJson(path.join(appRoot, "package.json"), repoRoot);
    if (pkg.dependencies?.["@hookform/resolvers"] || pkg.devDependencies?.["@hookform/resolvers"]) {
      fail(
        `${pkg.name} declares @hookform/resolvers but only @atlas/ui imports it (useZodForm). Remove from app manifest.`,
      );
    }
  }
}

const workspaceRoots = discoverWorkspaceRoots(repoRoot);

checkGenericWorkspaceOwnership();
checkAlignedVersions(workspaceRoots);
checkLockfileSources();
checkStaleUiPackages();
checkAppStylingDuplicates();
checkHookformResolverOwnership();

if (errors.length > 0) {
  console.error("Dependency validation failed:\n");
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log("✓ Dependency ownership checks passed");
