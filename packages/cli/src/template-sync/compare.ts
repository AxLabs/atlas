import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { AppInfrastructureManifest } from "./manifest";

export interface TemplateSyncDrift {
  relativePath: string;
  consumerApplication: string;
  kind: "missing-in-consumer" | "missing-in-canonical" | "content-drift";
  message: string;
}

export interface StructuralConformanceIssue {
  application: string;
  relativePath: string;
  kind: "missing-required-module" | "reference-only-missing" | "starter-only-present-in-consumer";
  message: string;
}

export interface TemplateSyncComparisonResult {
  drifts: TemplateSyncDrift[];
  structuralIssues: StructuralConformanceIssue[];
}

export function compareAppInfrastructureManifest(
  repoRoot: string,
  manifest: AppInfrastructureManifest
): TemplateSyncComparisonResult {
  const drifts: TemplateSyncDrift[] = [];
  const structuralIssues: StructuralConformanceIssue[] = [];
  const canonicalRoot = path.join(repoRoot, manifest.canonicalApplication);

  for (const consumerApplication of manifest.consumerApplications) {
    for (const relativePath of manifest.syncedPaths) {
      const canonicalPath = path.join(canonicalRoot, relativePath);
      const consumerPath = path.join(repoRoot, consumerApplication, relativePath);

      if (!existsSync(canonicalPath)) {
        drifts.push({
          relativePath,
          consumerApplication,
          kind: "missing-in-canonical",
          message: `Canonical starter is missing synced path ${relativePath}.`,
        });
        continue;
      }

      if (!existsSync(consumerPath)) {
        drifts.push({
          relativePath,
          consumerApplication,
          kind: "missing-in-consumer",
          message: `Consumer application is missing synced path ${relativePath}.`,
        });
        continue;
      }

      const canonicalContent = readFileSync(canonicalPath);
      const consumerContent = readFileSync(consumerPath);

      if (!canonicalContent.equals(consumerContent)) {
        drifts.push({
          relativePath,
          consumerApplication,
          kind: "content-drift",
          message: `Synced path ${relativePath} differs between ${manifest.canonicalApplication} and ${consumerApplication}.`,
        });
      }
    }

    const independentForConsumer = manifest.independentPaths[consumerApplication] ?? {};
    for (const [relativePath, reason] of Object.entries(independentForConsumer)) {
      const consumerPath = path.join(repoRoot, consumerApplication, relativePath);

      if (!existsSync(consumerPath)) {
        structuralIssues.push({
          application: consumerApplication,
          relativePath,
          kind: "missing-required-module",
          message: `Independent path ${relativePath} is missing in ${consumerApplication}: ${reason}`,
        });
      }
    }

    for (const relativePath of manifest.referenceOnlyPaths) {
      const consumerPath = path.join(repoRoot, consumerApplication, relativePath);
      if (!existsSync(consumerPath)) {
        structuralIssues.push({
          application: consumerApplication,
          relativePath,
          kind: "reference-only-missing",
          message: `Reference-only path ${relativePath} is missing in ${consumerApplication}.`,
        });
      }
    }

    for (const relativePath of manifest.starterOnlyPaths) {
      const consumerPath = path.join(repoRoot, consumerApplication, relativePath);
      if (existsSync(consumerPath)) {
        structuralIssues.push({
          application: consumerApplication,
          relativePath,
          kind: "starter-only-present-in-consumer",
          message: `Starter-only path ${relativePath} should not exist in ${consumerApplication}.`,
        });
      }
    }

    const requiredModules = manifest.structuralConformance?.requiredInfrastructureModules ?? [];
    for (const relativePath of requiredModules) {
      const consumerPath = path.join(repoRoot, consumerApplication, relativePath);
      if (!existsSync(consumerPath)) {
        structuralIssues.push({
          application: consumerApplication,
          relativePath,
          kind: "missing-required-module",
          message: `Required infrastructure module ${relativePath} is missing in ${consumerApplication}.`,
        });
      }
    }
  }

  for (const relativePath of manifest.starterOnlyPaths) {
    const canonicalPath = path.join(canonicalRoot, relativePath);
    if (!existsSync(canonicalPath)) {
      structuralIssues.push({
        application: manifest.canonicalApplication,
        relativePath,
        kind: "missing-required-module",
        message: `Starter-only path ${relativePath} is missing in ${manifest.canonicalApplication}.`,
      });
    }
  }

  return { drifts, structuralIssues };
}
