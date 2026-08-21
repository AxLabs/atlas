import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { createDiagnostic, DoctorDiagnosticCode } from "./diagnostics";
import { joinRepoAbsolutePath, toPosixRepoRelativePath } from "./paths";
import { extractStaticModuleSpecifiers, packageRootFromSpecifier } from "./static-imports";

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
    const imports = extractStaticModuleSpecifiers(sourceFile);

    for (const entry of imports) {
      const packageName = packageRootFromSpecifier(entry.specifier);
      if (!packageName || workspace.dependencies.has(packageName)) {
        continue;
      }

      diagnostics.push(
        createDiagnostic(
          DoctorDiagnosticCode.DEPENDENCY_UNDECLARED,
          `Workspace ${workspace.relativeRoot} imports "${packageName}" but does not declare it in package.json.`,
          {
            path: toPosixRepoRelativePath(context.repoRoot, sourceFile),
            line: entry.line,
            column: entry.column,
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

export { packageRootFromSpecifier };
