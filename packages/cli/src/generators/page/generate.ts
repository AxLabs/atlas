import type { ResolvedAtlasProject } from "@atlas/project";

import { buildGenerationPlan } from "../engine/plan";
import { routeToPageComponentName, routeToPageTitle, validateAppRouterRoute } from "../naming";
import { resolveAppRouterRoot, resolvePageFilePath } from "../paths";
import { renderPage } from "../templates/page";

import type { GeneratedFile, GenerationPlan } from "../types";

export interface PageGeneratorOptions {
  route: string;
}

function defaultFollowUpActions(route: string): string[] {
  return [
    "Compose this route from the matching feature module's public exports.",
    "Add the new route to product navigation if it should be user-visible.",
    `Wire domain behavior for route "${route}" in the feature module.`,
  ];
}

export function renderPageFiles(
  project: ResolvedAtlasProject,
  options: PageGeneratorOptions
): Pick<GenerationPlan, "files" | "normalizedInput" | "targetRoot" | "followUpActions"> {
  const route = validateAppRouterRoute(options.route);
  const pageRelativePath = resolvePageFilePath(project, route);
  const appRouterRoot = resolveAppRouterRoot(project);

  const files: GeneratedFile[] = [
    {
      relativePath: pageRelativePath,
      content: renderPage({
        route,
        pageTitle: routeToPageTitle(route),
        componentName: routeToPageComponentName(route),
      }),
    },
  ];

  return {
    normalizedInput: route,
    targetRoot: appRouterRoot,
    files,
    followUpActions: defaultFollowUpActions(route),
  };
}

export function planPageGenerationForRepo(
  repoRoot: string,
  project: ResolvedAtlasProject,
  options: PageGeneratorOptions
): GenerationPlan {
  const rendered = renderPageFiles(project, options);
  return buildGenerationPlan({
    repoRoot,
    generatorType: "page",
    ...rendered,
  });
}
