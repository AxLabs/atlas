import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const NON_REGISTRY_SPEC_PATTERNS = [
  /^git\+/i,
  /^git:\/\//i,
  /^github:/i,
  /^gitlab:/i,
  /^bitbucket:/i,
  /^ssh:\/\//i,
  /^file:/i,
  /^link:/i,
  /^workspace:/i,
  /^https?:\/\//i,
  /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(?:#.+)?$/,
];

const NPM_ALIAS_PATTERN = /^npm:(?:@[^@]+\/[^@]+|[^@]+)@/;

const LOCKFILE_NON_REGISTRY_PATTERNS = [
  /^\s+tarball:\s/i,
  /^\s+repo:\s+git/i,
  /^\s+type:\s+git\b/i,
  /^\s+fromGit:\s/i,
  /^\s+directory:\s/i,
];

function listDependencySections(pkg) {
  return {
    dependencies: pkg.dependencies ?? {},
    devDependencies: pkg.devDependencies ?? {},
    optionalDependencies: pkg.optionalDependencies ?? {},
    peerDependencies: pkg.peerDependencies ?? {},
  };
}

export function isAtlasWorkspaceLink(name, spec) {
  return name.startsWith("@atlas/") && spec === "workspace:*";
}

export function isNonRegistryDependencySpec(spec) {
  if (typeof spec !== "string" || spec.trim().length === 0) {
    return false;
  }

  const trimmed = spec.trim();

  if (NPM_ALIAS_PATTERN.test(trimmed)) {
    return false;
  }

  return NON_REGISTRY_SPEC_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function discoverWorkspacePackageRoots(repoRoot) {
  const workspaceFile = path.join(repoRoot, "pnpm-workspace.yaml");
  const workspaceYaml = readFileSync(workspaceFile, "utf8");
  const packageGlobs = [...workspaceYaml.matchAll(/^\s+-\s+"([^"]+)"/gm)].map(
    (match) => match[1],
  );
  const roots = new Set(["."]);

  for (const glob of packageGlobs) {
    if (!glob.endsWith("/*")) {
      roots.add(glob);
      continue;
    }

    const base = glob.slice(0, -2);
    const parent = path.join(repoRoot, base);
    if (!existsSync(parent)) {
      continue;
    }

    for (const entry of readdirSync(parent, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        roots.add(path.join(base, entry.name));
      }
    }
  }

  return [...roots].sort();
}

export function collectWorkspaceDependencySourceFindings(repoRoot) {
  const findings = [];

  for (const workspaceRoot of discoverWorkspacePackageRoots(repoRoot)) {
    const pkgPath = path.join(repoRoot, workspaceRoot, "package.json");
    if (!existsSync(pkgPath)) {
      continue;
    }

    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

    for (const [sectionName, section] of Object.entries(listDependencySections(pkg))) {
      for (const [name, spec] of Object.entries(section)) {
        if (isAtlasWorkspaceLink(name, spec)) {
          continue;
        }

        if (isNonRegistryDependencySpec(spec)) {
          findings.push({
            workspace: pkg.name ?? workspaceRoot,
            section: sectionName,
            dependency: name,
            spec,
          });
        }
      }
    }
  }

  return findings.sort(
    (left, right) =>
      left.workspace.localeCompare(right.workspace) ||
      left.dependency.localeCompare(right.dependency),
  );
}

function isAllowedWorkspaceLockfileLink(line, contextLines) {
  if (!/^\s+version:\s+link:/.test(line)) {
    return false;
  }

  const context = contextLines.join("\n");
  return (
    /specifier:\s+workspace:\*/.test(context) ||
    /link:(?:\.\.\/)+packages\//.test(line) ||
    /link:packages\//.test(line)
  );
}

export function collectLockfileNonRegistryFindings(repoRoot) {
  const lockPath = path.join(repoRoot, "pnpm-lock.yaml");
  if (!statSync(lockPath).isFile()) {
    return [{ line: 0, text: "Missing pnpm-lock.yaml" }];
  }

  const lines = readFileSync(lockPath, "utf8").split("\n");
  const findings = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const contextLines = lines.slice(Math.max(0, i - 3), i + 1);

    if (LOCKFILE_NON_REGISTRY_PATTERNS.some((pattern) => pattern.test(line))) {
      findings.push({ line: i + 1, text: line.trim() });
      continue;
    }

    if (/^\s+version:\s+link:/.test(line) && !isAllowedWorkspaceLockfileLink(line, contextLines)) {
      findings.push({ line: i + 1, text: line.trim() });
      continue;
    }

    if (/^\s+version:\s+file:/.test(line)) {
      findings.push({ line: i + 1, text: line.trim() });
    }
  }

  return findings;
}

export function formatDependencySourceFinding(finding) {
  if ("workspace" in finding) {
    return `${finding.workspace} (${finding.section}): ${finding.dependency} declares non-registry source "${finding.spec}"`;
  }

  return `Suspicious package source in pnpm-lock.yaml line ${finding.line}: ${finding.text}`;
}

export function collectDependencySourceFindings(repoRoot) {
  return [
    ...collectWorkspaceDependencySourceFindings(repoRoot).map((finding) => ({
      kind: "workspace",
      ...finding,
    })),
    ...collectLockfileNonRegistryFindings(repoRoot).map((finding) => ({
      kind: "lockfile",
      ...finding,
    })),
  ];
}
