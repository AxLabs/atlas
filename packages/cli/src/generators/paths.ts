import path from "node:path";

import { joinRepoPath, normalizeRepoRelativePath, type ResolvedAtlasProject } from "@atlas/project";

/** Atlas convention: App Router source lives under `<application.root>/src/app`. */
export function resolveAppRouterRoot(project: ResolvedAtlasProject): string {
  return normalizeRepoRelativePath(path.posix.join(project.application.root, "src/app"));
}

export function resolveFeatureRoot(project: ResolvedAtlasProject, featureName: string): string {
  return normalizeRepoRelativePath(path.posix.join(project.features.product, featureName));
}

export function resolvePageFilePath(project: ResolvedAtlasProject, route: string): string {
  return normalizeRepoRelativePath(
    path.posix.join(resolveAppRouterRoot(project), route, "page.tsx")
  );
}

export function collectReservedFeatureNames(project: ResolvedAtlasProject): Set<string> {
  const reserved = new Set<string>();
  const productRoot = normalizeRepoRelativePath(project.features.product);

  for (const architectureRoot of [project.features.reference, project.features.examples]) {
    const normalized = normalizeRepoRelativePath(architectureRoot);
    if (normalized === productRoot) {
      continue;
    }

    if (normalized.startsWith(`${productRoot}/`)) {
      const remainder = normalized.slice(productRoot.length + 1);
      const segment = remainder.split("/")[0];
      if (segment) {
        reserved.add(segment);
      }
      continue;
    }

    reserved.add(path.posix.basename(normalized));
  }

  return reserved;
}

export function assertFeatureDestinationAllowed(
  project: ResolvedAtlasProject,
  featureName: string,
  featureRoot: string
): void {
  const reserved = collectReservedFeatureNames(project);
  if (reserved.has(featureName)) {
    throw new Error(
      `Feature name "${featureName}" is reserved for Atlas architecture (${Array.from(reserved).join(", ")}).`
    );
  }

  const normalizedFeatureRoot = normalizeRepoRelativePath(featureRoot);
  for (const architectureRoot of [project.features.reference, project.features.examples]) {
    if (normalizedFeatureRoot === normalizeRepoRelativePath(architectureRoot)) {
      throw new Error(
        `Feature destination ${normalizedFeatureRoot} is reserved for Atlas architecture.`
      );
    }
  }
}

export function toAbsoluteRepoPath(repoRoot: string, relativePath: string): string {
  return joinRepoPath(repoRoot, relativePath);
}
