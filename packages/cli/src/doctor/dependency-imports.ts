import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { createDiagnostic, DoctorDiagnosticCode } from "./diagnostics";
import { joinRepoAbsolutePath, toPosixRepoRelativePath } from "./paths";
import { extractStaticModuleSpecifiers, packageRootFromSpecifier } from "./static-imports";
import { discoverWorkspaceRoots } from "./workspace-membership";

import type { DoctorContext } from "./context";
import type { DoctorDiagnostic } from "./types";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"]);
const IGNORED_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "coverage",
  ".turbo",
  ".git",
  "storybook-static",
  "playwright-report",
  "test-results",
]);

const APPLICATION_ONLY_IGNORED_DIRS = new Set(["test", "scripts"]);

export type DependencyScanMode = "application" | "repository";

export interface UndeclaredDependencyFinding {
  workspaceRoot: string;
  packageName: string;
  filePath: string;
  line: number;
  column: number;
}

interface WorkspacePackage {
  relativeRoot: string;
  manifestPath: string;
  name?: string;
  dependencies: Set<string>;
}

interface WorkspaceScanOptions {
  scanMode?: DependencyScanMode;
}

export function findUndeclaredDependencyDiagnostics(context: DoctorContext): DoctorDiagnostic[] {
  if (!context.project) {
    return [];
  }

  const findings = findUndeclaredDependenciesForWorkspace(
    context.repoRoot,
    context.project.application.root,
    { scanMode: "application" }
  );

  return findings.map((finding) =>
    createDiagnostic(
      DoctorDiagnosticCode.DEPENDENCY_UNDECLARED,
      `Workspace ${finding.workspaceRoot} imports "${finding.packageName}" but does not declare it in package.json.`,
      {
        path: finding.filePath,
        line: finding.line,
        column: finding.column,
        suggestedFix: `Declare "${finding.packageName}" in ${path.posix.join(finding.workspaceRoot, "package.json")} because this workspace imports it directly.`,
      }
    )
  );
}

export function findUndeclaredDependenciesForWorkspace(
  repoRoot: string,
  workspaceRoot: string,
  options?: WorkspaceScanOptions
): UndeclaredDependencyFinding[] {
  const scanMode = options?.scanMode ?? "repository";
  const workspace = readWorkspacePackage(repoRoot, workspaceRoot);
  if (!workspace) {
    return [];
  }

  const sourceRoot = joinRepoAbsolutePath(repoRoot, workspace.relativeRoot);
  if (!existsSync(sourceRoot)) {
    return [];
  }

  return collectUndeclaredDependenciesFromSourceFilesForWorkspace(
    repoRoot,
    workspace,
    walkSourceFiles(sourceRoot, scanMode)
  );
}

export function collectUndeclaredDependenciesFromSourceFiles(
  repoRoot: string,
  workspaceRoot: string,
  sourceFiles: readonly string[]
): UndeclaredDependencyFinding[] {
  const workspace = readWorkspacePackage(repoRoot, workspaceRoot);
  if (!workspace) {
    return [];
  }

  return collectUndeclaredDependenciesFromSourceFilesForWorkspace(repoRoot, workspace, sourceFiles);
}

function collectUndeclaredDependenciesFromSourceFilesForWorkspace(
  repoRoot: string,
  workspace: WorkspacePackage,
  sourceFiles: readonly string[]
): UndeclaredDependencyFinding[] {
  const findings: UndeclaredDependencyFinding[] = [];

  for (const sourceFile of sourceFiles) {
    const sourceText = readExistingSourceFile(sourceFile);
    if (sourceText === undefined) {
      continue;
    }

    const imports = extractStaticModuleSpecifiers(sourceFile, sourceText);

    for (const entry of imports) {
      const packageName = packageRootFromSpecifier(entry.specifier);
      if (!packageName || workspace.dependencies.has(packageName)) {
        continue;
      }

      findings.push({
        workspaceRoot: workspace.relativeRoot,
        packageName,
        filePath: toPosixRepoRelativePath(repoRoot, sourceFile),
        line: entry.line,
        column: entry.column,
      });
    }
  }

  return dedupeFindings(findings);
}

export function findUndeclaredDependenciesForAllWorkspaces(
  repoRoot: string,
  options?: WorkspaceScanOptions
): UndeclaredDependencyFinding[] {
  const scanMode = options?.scanMode ?? "repository";
  const workspaceRoots = discoverWorkspaceRoots(repoRoot);
  const findings: UndeclaredDependencyFinding[] = [];

  for (const workspaceRoot of workspaceRoots) {
    findings.push(...findUndeclaredDependenciesForWorkspace(repoRoot, workspaceRoot, { scanMode }));
  }

  return dedupeFindings(findings);
}

function readWorkspacePackage(repoRoot: string, relativeRoot: string): WorkspacePackage | null {
  const manifestPath = joinRepoAbsolutePath(
    repoRoot,
    path.posix.join(relativeRoot, "package.json")
  );
  if (!existsSync(manifestPath)) {
    return null;
  }

  const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    name?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };

  const dependencies = new Set<string>([
    ...Object.keys(parsed.dependencies ?? {}),
    ...Object.keys(parsed.devDependencies ?? {}),
    ...Object.keys(parsed.peerDependencies ?? {}),
  ]);

  return {
    relativeRoot,
    manifestPath,
    name: parsed.name,
    dependencies,
  };
}

function walkSourceFiles(root: string, scanMode: DependencyScanMode): string[] {
  const files: string[] = [];

  function walk(current: string): void {
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch (error) {
      if (isEnoentError(error)) {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      if (scanMode === "application") {
        if (
          entry === "__tests__" ||
          entry.endsWith(".test.ts") ||
          entry.endsWith(".test.tsx") ||
          entry.endsWith(".spec.ts") ||
          entry.endsWith(".spec.tsx")
        ) {
          continue;
        }
      }

      const absolutePath = path.join(current, entry);
      let stats;
      try {
        stats = statSync(absolutePath);
      } catch (error) {
        if (isEnoentError(error)) {
          continue;
        }
        throw error;
      }

      if (stats.isDirectory()) {
        if (IGNORED_DIRS.has(entry)) {
          continue;
        }

        // Packaged bootstrap assets live at <cli-package>/assets and are not CLI source.
        if (current === root && entry === "assets") {
          continue;
        }

        if (scanMode === "application" && APPLICATION_ONLY_IGNORED_DIRS.has(entry)) {
          continue;
        }

        if (entry === "fixtures" && path.basename(current) === "__tests__") {
          continue;
        }

        walk(absolutePath);
        continue;
      }

      if (isScannableFile(entry, scanMode)) {
        files.push(absolutePath);
      }
    }
  }

  walk(root);
  return files.sort();
}

function readExistingSourceFile(sourceFilePath: string): string | undefined {
  try {
    return readFileSync(sourceFilePath, "utf8");
  } catch (error) {
    if (isEnoentError(error)) {
      return undefined;
    }
    throw error;
  }
}

function isEnoentError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function isScannableFile(entry: string, scanMode: DependencyScanMode): boolean {
  if (SOURCE_EXTENSIONS.has(path.extname(entry))) {
    return true;
  }

  if (scanMode !== "repository") {
    return false;
  }

  if (
    entry.endsWith(".config.js") ||
    entry.endsWith(".config.mjs") ||
    entry.endsWith(".config.ts")
  ) {
    return true;
  }

  return entry.endsWith(".stories.ts") || entry.endsWith(".stories.tsx");
}

function dedupeFindings(findings: UndeclaredDependencyFinding[]): UndeclaredDependencyFinding[] {
  const seen = new Set<string>();
  const unique: UndeclaredDependencyFinding[] = [];

  for (const finding of findings) {
    const key = [
      finding.workspaceRoot,
      finding.packageName,
      finding.filePath,
      finding.line,
      finding.column,
    ].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(finding);
  }

  return unique;
}

export { discoverWorkspaceRoots, packageRootFromSpecifier };
