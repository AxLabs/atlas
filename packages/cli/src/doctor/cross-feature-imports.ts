import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { createDiagnostic, DoctorDiagnosticCode } from "./diagnostics";
import { joinRepoAbsolutePath, toPosixRepoRelativePath } from "./paths";

import type { DoctorContext } from "./context";
import type { DoctorDiagnostic } from "./types";

const IMPORT_FROM_PATTERN = /\bfrom\s+["']([^"']+)["']/g;
const SIDE_EFFECT_IMPORT_PATTERN = /\bimport\s+["']([^"']+)["']/g;
const REQUIRE_PATTERN = /\brequire\(\s*["']([^"']+)["']\s*\)/g;

const IGNORED_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "coverage",
  ".turbo",
  ".git",
  "__tests__",
]);

export function findCrossFeatureImportDiagnostics(context: DoctorContext): DoctorDiagnostic[] {
  if (!context.project?.boundaries.noFeatureToFeatureImports) {
    return [];
  }

  const productRoot = joinRepoAbsolutePath(context.repoRoot, context.project.features.product);
  if (!existsSync(productRoot)) {
    return [];
  }

  const featureNames = listProductFeatureNames(productRoot, context);
  const diagnostics: DoctorDiagnostic[] = [];

  for (const featureName of featureNames) {
    const featureDir = path.join(productRoot, featureName);
    for (const sourceFile of walkSourceFiles(featureDir)) {
      const content = readFileSync(sourceFile, "utf8");
      for (const pattern of [IMPORT_FROM_PATTERN, SIDE_EFFECT_IMPORT_PATTERN, REQUIRE_PATTERN]) {
        for (const match of content.matchAll(pattern)) {
          const specifier = match[1];
          if (!specifier) {
            continue;
          }

          const importedFeature = resolveImportedProductFeature(
            specifier,
            featureNames,
            context,
            sourceFile,
            productRoot
          );

          if (!importedFeature || importedFeature === featureName) {
            continue;
          }

          diagnostics.push(
            createDiagnostic(
              DoctorDiagnosticCode.BOUNDARY_CROSS_FEATURE_IMPORT,
              `Product feature "${featureName}" must not import product feature "${importedFeature}".`,
              {
                path: toPosixRepoRelativePath(context.repoRoot, sourceFile),
                suggestedFix:
                  "Extract shared logic to src/lib/ and import from there instead of importing another product feature.",
              }
            )
          );
        }
      }
    }
  }

  return diagnostics;
}

function listProductFeatureNames(productRoot: string, context: DoctorContext): string[] {
  const excluded = new Set([
    path.basename(context.project!.features.reference),
    path.basename(context.project!.features.examples),
    "reference",
    "examples",
  ]);

  return readdirSync(productRoot)
    .filter((entry) => {
      if (excluded.has(entry)) {
        return false;
      }

      return statSync(path.join(productRoot, entry)).isDirectory();
    })
    .sort();
}

function resolveImportedProductFeature(
  specifier: string,
  featureNames: string[],
  context: DoctorContext,
  sourceFile: string,
  productRoot: string
): string | undefined {
  const productImportPrefix = `@/features/`;
  if (specifier.startsWith(productImportPrefix)) {
    const remainder = specifier.slice(productImportPrefix.length);
    const featureName = remainder.split("/")[0];
    return featureName && featureNames.includes(featureName) ? featureName : undefined;
  }

  if (specifier.startsWith(".")) {
    const resolved = path.resolve(path.dirname(sourceFile), specifier);
    const relative = path.relative(productRoot, resolved);
    if (relative.startsWith("..") || relative === "") {
      return undefined;
    }

    const featureName = relative.split(path.sep)[0];
    return featureName && featureNames.includes(featureName) ? featureName : undefined;
  }

  for (const featureName of featureNames) {
    const marker = `${context.project!.features.product}/${featureName}`;
    if (specifier.includes(marker)) {
      return featureName;
    }
  }

  return undefined;
}

function walkSourceFiles(root: string): string[] {
  const files: string[] = [];

  function walk(current: string): void {
    for (const entry of readdirSync(current)) {
      if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx") || entry.endsWith(".spec.ts")) {
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

      if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
        files.push(absolutePath);
      }
    }
  }

  walk(root);
  return files.sort();
}
