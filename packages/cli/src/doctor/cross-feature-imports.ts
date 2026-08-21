import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { createDiagnostic, DoctorDiagnosticCode } from "./diagnostics";
import {
  deriveProductFeatureImportPrefix,
  resolveImportedProductFeatureName,
} from "./feature-alias";
import { joinRepoAbsolutePath, toPosixRepoRelativePath } from "./paths";
import { extractStaticModuleSpecifiers } from "./static-imports";

import type { DoctorContext } from "./context";
import type { DoctorDiagnostic } from "./types";

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

  const productImportPrefix = deriveProductFeatureImportPrefix(context.project);
  if (!productImportPrefix) {
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
      for (const entry of extractStaticModuleSpecifiers(sourceFile)) {
        const importedFeature = resolveImportedProductFeatureName(
          entry.specifier,
          featureNames,
          productImportPrefix
        );

        if (!importedFeature || importedFeature === featureName) {
          const relativeImport = resolveRelativeProductFeatureImport(
            entry.specifier,
            sourceFile,
            productRoot,
            featureNames
          );
          if (!relativeImport || relativeImport === featureName) {
            continue;
          }

          diagnostics.push(
            createCrossFeatureDiagnostic(context, sourceFile, featureName, relativeImport)
          );
          continue;
        }

        diagnostics.push(
          createCrossFeatureDiagnostic(context, sourceFile, featureName, importedFeature)
        );
      }
    }
  }

  return diagnostics;
}

function createCrossFeatureDiagnostic(
  context: DoctorContext,
  sourceFile: string,
  featureName: string,
  importedFeature: string
): DoctorDiagnostic {
  return createDiagnostic(
    DoctorDiagnosticCode.BOUNDARY_CROSS_FEATURE_IMPORT,
    `Product feature "${featureName}" must not import product feature "${importedFeature}".`,
    {
      path: toPosixRepoRelativePath(context.repoRoot, sourceFile),
      suggestedFix:
        "Extract shared logic to src/lib/ and import from there instead of importing another product feature.",
    }
  );
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

function resolveRelativeProductFeatureImport(
  specifier: string,
  sourceFile: string,
  productRoot: string,
  featureNames: string[]
): string | undefined {
  if (!specifier.startsWith(".")) {
    return undefined;
  }

  const resolved = path.resolve(path.dirname(sourceFile), specifier);
  const relative = path.relative(productRoot, resolved);
  if (relative.startsWith("..") || relative === "") {
    return undefined;
  }

  const featureName = relative.split(path.sep)[0];
  return featureName && featureNames.includes(featureName) ? featureName : undefined;
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

export { deriveProductFeatureImportPrefix };
