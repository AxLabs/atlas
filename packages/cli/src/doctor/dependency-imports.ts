import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";

import { createDiagnostic, DoctorDiagnosticCode } from "./diagnostics";
import { joinRepoAbsolutePath, toPosixRepoRelativePath } from "./paths";

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
  "test",
  "scripts",
]);

const IMPORT_FROM_PATTERN = /\bfrom\s+["']([^"']+)["']/g;
const SIDE_EFFECT_IMPORT_PATTERN = /\bimport\s+["']([^"']+)["']/g;
const REQUIRE_PATTERN = /\brequire\(\s*["']([^"']+)["']\s*\)/g;

interface WorkspacePackage {
  relativeRoot: string;
  manifestPath: string;
  name?: string;
  dependencies: Set<string>;
}

export function findUndeclaredDependencyDiagnostics(context: DoctorContext): DoctorDiagnostic[] {
  if (!context.project) {
    return [];
  }

  const applicationRoot = context.project.application.root;
  const workspace = readWorkspacePackage(context.repoRoot, applicationRoot);
  if (!workspace) {
    return [];
  }

  const diagnostics: DoctorDiagnostic[] = [];
  const sourceRoot = joinRepoAbsolutePath(context.repoRoot, workspace.relativeRoot);
  if (!existsSync(sourceRoot)) {
    return [];
  }

  for (const sourceFile of walkSourceFiles(sourceRoot)) {
    const content = readFileSync(sourceFile, "utf8");
    const imports = extractImportSpecifiers(content);

    for (const specifier of imports) {
      const packageName = classifyPackageName(specifier);
      if (!packageName || workspace.dependencies.has(packageName)) {
        continue;
      }

      diagnostics.push(
        createDiagnostic(
          DoctorDiagnosticCode.DEPENDENCY_UNDECLARED,
          `Workspace ${workspace.relativeRoot} imports "${packageName}" but does not declare it in package.json.`,
          {
            path: toPosixRepoRelativePath(context.repoRoot, sourceFile),
            suggestedFix: `Declare "${packageName}" in ${path.posix.join(workspace.relativeRoot, "package.json")} because this workspace imports it directly.`,
          }
        )
      );
    }
  }

  return dedupeByKey(diagnostics, (diagnostic) =>
    [diagnostic.code, diagnostic.path ?? "", diagnostic.message].join("|")
  );
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

function walkSourceFiles(root: string): string[] {
  const files: string[] = [];

  function walk(current: string): void {
    for (const entry of readdirSync(current)) {
      if (
        entry === "__tests__" ||
        entry.endsWith(".test.ts") ||
        entry.endsWith(".test.tsx") ||
        entry.endsWith(".spec.ts") ||
        entry.endsWith(".spec.tsx")
      ) {
        continue;
      }

      const absolutePath = path.join(current, entry);
      const stats = statSync(absolutePath);

      if (stats.isDirectory()) {
        if (IGNORED_DIRS.has(entry)) {
          continue;
        }
        walk(absolutePath);
        continue;
      }

      if (SOURCE_EXTENSIONS.has(path.extname(entry))) {
        files.push(absolutePath);
      }
    }
  }

  walk(root);
  return files.sort();
}

function extractImportSpecifiers(content: string): string[] {
  const specifiers = new Set<string>();

  for (const pattern of [IMPORT_FROM_PATTERN, SIDE_EFFECT_IMPORT_PATTERN, REQUIRE_PATTERN]) {
    for (const match of content.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier) {
        specifiers.add(specifier);
      }
    }
  }

  return [...specifiers].sort();
}

function classifyPackageName(specifier: string): string | undefined {
  if (
    specifier.startsWith(".") ||
    specifier.startsWith("@/") ||
    specifier.startsWith("~/") ||
    specifier.startsWith("#")
  ) {
    return undefined;
  }

  const normalized = specifier.startsWith("node:") ? specifier.slice(5) : specifier;
  if (builtinModules.includes(normalized) || builtinModules.includes(`node:${normalized}`)) {
    return undefined;
  }

  if (specifier.startsWith("@atlas/")) {
    const workspaceName = specifier.split("/").slice(0, 2).join("/");
    return workspaceName;
  }

  if (specifier.startsWith("@")) {
    const segments = specifier.split("/");
    return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : segments[0];
  }

  if (specifier.includes("/")) {
    return undefined;
  }

  return specifier;
}

function dedupeByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(item);
  }

  return unique;
}
