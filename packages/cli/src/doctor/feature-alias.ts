import path from "node:path";

import type { ResolvedAtlasProject } from "@atlas/project";

export function applicationSourceRoot(project: ResolvedAtlasProject): string {
  return path.posix.join(project.application.root, "src");
}

export function deriveAppAliasPrefix(
  project: ResolvedAtlasProject,
  repoRelativePath: string
): string | undefined {
  const normalizedPath = repoRelativePath.replace(/\\/g, "/");
  const sourceRoot = applicationSourceRoot(project);

  if (normalizedPath === sourceRoot) {
    return "@/";
  }

  if (!normalizedPath.startsWith(`${sourceRoot}/`)) {
    return undefined;
  }

  const relativeFromSrc = path.posix.relative(sourceRoot, normalizedPath);
  if (relativeFromSrc.startsWith("..") || relativeFromSrc === "") {
    return undefined;
  }

  return `@/${relativeFromSrc}/`;
}

export function deriveProductFeatureImportPrefix(
  project: ResolvedAtlasProject
): string | undefined {
  return deriveAppAliasPrefix(project, project.features.product);
}

export function resolveImportedProductFeatureName(
  specifier: string,
  featureNames: string[],
  productImportPrefix: string | undefined
): string | undefined {
  if (productImportPrefix && specifier.startsWith(productImportPrefix)) {
    const remainder = specifier.slice(productImportPrefix.length);
    const featureName = remainder.split("/")[0];
    return featureName && featureNames.includes(featureName) ? featureName : undefined;
  }

  return undefined;
}
