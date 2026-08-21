import path from "node:path";

import type { ResolvedAtlasProject } from "@atlas/project";

import { CliError, CliErrorCode } from "../../errors/cli-error";
import { buildGenerationPlan } from "../engine/plan";
import { parseFeatureName } from "../naming";
import { assertFeatureDestinationAllowed, resolveFeatureRoot } from "../paths";
import {
  type FeatureTemplateOptions,
  renderFeatureComponent,
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

function defaultFollowUpActions(
  naming: ReturnType<typeof parseFeatureName>,
  options: FeatureGeneratorOptions
): string[] {
  const actions = [
    `Implement product-specific UI and behavior inside ${naming.pascal}Feature.`,
    `Generate or create a thin App Router page that imports ${naming.pascal}Feature from the feature public boundary.`,
  ];

  if (options.query) {
    actions.unshift(`Implement ${naming.kebab} list fetching in the query scaffold seam.`);
  }

  if (options.mutation) {
    actions.unshift(`Implement ${naming.kebab} mutation behavior in the mutation scaffold seam.`);
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
  if (options.tests && !options.query) {
    throw new CliError(CliErrorCode.USAGE_ERROR, "The --tests flag requires --query.");
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
    relativePath: path.posix.join(featureRoot, "components", `${naming.pascal}Feature.tsx`),
    content: renderFeatureComponent(templateContext),
  });

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
    followUpActions: defaultFollowUpActions(naming, options),
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
