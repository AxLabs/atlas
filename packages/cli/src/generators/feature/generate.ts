import path from "node:path";

import type { ResolvedAtlasProject } from "@atlas/project";

import { CliError, CliErrorCode } from "../../errors/cli-error";
import { buildGenerationPlan } from "../engine/plan";
import { parseFeatureName } from "../naming";
import { assertFeatureDestinationAllowed, resolveFeatureRoot } from "../paths";
import {
  type FeatureTemplateOptions,
  renderFeatureFormComponent,
  renderFeatureIndex,
  renderFeatureIndexWithExports,
  renderFeatureKeys,
  renderFeatureKeysTest,
  renderFeatureMutations,
  renderFeatureQueries,
  renderFeatureSchema,
} from "../templates/feature";

import type { GeneratedFile, GenerationPlan } from "../types";

export interface FeatureGeneratorOptions extends FeatureTemplateOptions {
  name: string;
}

function defaultFollowUpActions(options: FeatureGeneratorOptions): string[] {
  const actions = [
    "Implement domain-specific behavior in the generated feature module.",
    "Add a thin App Router page that composes this feature when the route is ready.",
  ];

  if (options.query) {
    actions.unshift("Implement the feature's domain-specific API query.");
  }

  if (options.mutation) {
    actions.unshift("Implement the feature's domain-specific mutation behavior.");
  }

  if (options.form) {
    actions.unshift(
      "Replace placeholder form fields with product-specific validation and submission."
    );
  }

  return actions;
}

export function renderFeatureFiles(
  project: ResolvedAtlasProject,
  options: FeatureGeneratorOptions
): Pick<GenerationPlan, "files" | "normalizedInput" | "targetRoot" | "followUpActions"> {
  if (options.tests && !options.query && !options.mutation && !options.form) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      "The --tests flag requires --query, --mutation, or --form."
    );
  }

  const naming = parseFeatureName(options.name);
  const featureRoot = resolveFeatureRoot(project, naming.kebab);

  try {
    assertFeatureDestinationAllowed(project, naming.kebab, featureRoot);
  } catch (error) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      error instanceof Error ? error.message : "Reserved feature destination."
    );
  }

  const templateContext = {
    naming,
    openApiEnabled: project.capabilities.openApi,
  };

  const files: GeneratedFile[] = [];
  const hasOptionalFiles = Boolean(
    options.query || options.mutation || options.form || options.tests
  );

  files.push({
    relativePath: path.posix.join(featureRoot, "index.ts"),
    content: hasOptionalFiles
      ? renderFeatureIndexWithExports(templateContext, options)
      : renderFeatureIndex(templateContext),
  });

  if (options.query || options.mutation) {
    files.push({
      relativePath: path.posix.join(featureRoot, "keys.ts"),
      content: renderFeatureKeys(templateContext),
    });
  }

  if (options.query) {
    files.push({
      relativePath: path.posix.join(featureRoot, "queries.ts"),
      content: renderFeatureQueries(templateContext),
    });
  }

  if (options.mutation) {
    files.push({
      relativePath: path.posix.join(featureRoot, "mutations.ts"),
      content: renderFeatureMutations(templateContext),
    });
  }

  if (options.form) {
    files.push({
      relativePath: path.posix.join(featureRoot, "schema.ts"),
      content: renderFeatureSchema(templateContext),
    });
    files.push({
      relativePath: path.posix.join(featureRoot, "components", `${naming.pascal}Form.tsx`),
      content: renderFeatureFormComponent(templateContext),
    });
  }

  if (options.tests && options.query) {
    files.push({
      relativePath: path.posix.join(featureRoot, "__tests__", "keys.test.ts"),
      content: renderFeatureKeysTest(templateContext),
    });
  }

  return {
    normalizedInput: naming.kebab,
    targetRoot: featureRoot,
    files,
    followUpActions: defaultFollowUpActions(options),
  };
}

export function planFeatureGenerationForRepo(
  repoRoot: string,
  project: ResolvedAtlasProject,
  options: FeatureGeneratorOptions
): GenerationPlan {
  const rendered = renderFeatureFiles(project, options);
  return buildGenerationPlan({
    repoRoot,
    generatorType: "feature",
    ...rendered,
    rejectExistingFeatureDirectory: true,
  });
}
