import path from "node:path";

import type { ResolvedAtlasProject } from "@atlas/project";

import { joinRepoAbsolutePath } from "./paths";

export const DEFAULT_PRODUCT_FEATURE_RELATIVE = "src/features";

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

export type ProductFeaturePolicyTarget =
  | {
      kind: "application-source";
      absolutePath: string;
      relativeFromApplication: string;
      aliasPrefix: string;
      isDefaultRoot: boolean;
    }
  | {
      kind: "unsupported";
      reason: string;
      configuredPath: string;
    };

export function resolveProductFeaturePolicyTarget(
  repoRoot: string,
  project: ResolvedAtlasProject
): ProductFeaturePolicyTarget {
  const configuredPath = project.features.product.replace(/\\/g, "/");
  const absolutePath = joinRepoAbsolutePath(repoRoot, configuredPath);
  const applicationRoot = path.join(repoRoot, project.application.root);
  const sourceRoot = applicationSourceRoot(project);
  const aliasPrefix = deriveAppAliasPrefix(project, configuredPath);

  if (!aliasPrefix) {
    return {
      kind: "unsupported",
      reason:
        `The configured product feature root "${configuredPath}" is outside the application source tree ` +
        `(${sourceRoot}) and Atlas Doctor cannot apply the application's feature architecture policy deterministically.`,
      configuredPath,
    };
  }

  const relativeFromApplication = path
    .relative(applicationRoot, absolutePath)
    .split(path.sep)
    .join("/");

  if (relativeFromApplication.startsWith("..")) {
    return {
      kind: "unsupported",
      reason:
        `The configured product feature root "${configuredPath}" is outside the application package ` +
        `(${project.application.root}) and Atlas Doctor cannot apply the application's feature architecture policy deterministically.`,
      configuredPath,
    };
  }

  return {
    kind: "application-source",
    absolutePath,
    relativeFromApplication,
    aliasPrefix,
    isDefaultRoot: relativeFromApplication === DEFAULT_PRODUCT_FEATURE_RELATIVE,
  };
}

export function deriveReferenceExamplesIgnoreGlobs(
  repoRoot: string,
  project: ResolvedAtlasProject
): { referenceIgnoreGlob?: string; examplesIgnoreGlob?: string } {
  const applicationRoot = path.join(repoRoot, project.application.root);
  const referenceAbs = joinRepoAbsolutePath(repoRoot, project.features.reference);
  const examplesAbs = joinRepoAbsolutePath(repoRoot, project.features.examples);
  const referenceRel = path.relative(applicationRoot, referenceAbs).split(path.sep).join("/");
  const examplesRel = path.relative(applicationRoot, examplesAbs).split(path.sep).join("/");

  return {
    referenceIgnoreGlob:
      !referenceRel.startsWith("..") && referenceRel.length > 0 ? `${referenceRel}/**` : undefined,
    examplesIgnoreGlob:
      !examplesRel.startsWith("..") && examplesRel.length > 0 ? `${examplesRel}/**` : undefined,
  };
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
