import type { GeneratorType } from "./types";

export interface GeneratorArgumentDefinition {
  name: string;
  required: boolean;
  description: string;
}

export interface GeneratorFlagDefinition {
  flag: string;
  description: string;
  appliesTo: GeneratorType | "all";
}

export interface GeneratorDefinition {
  id: GeneratorType;
  description: string;
  usage: string;
  targetOwnership: string;
  conflictBehavior: string;
  arguments: GeneratorArgumentDefinition[];
  flags: GeneratorFlagDefinition[];
}

export const GENERATOR_DEFINITIONS: GeneratorDefinition[] = [
  {
    id: "feature",
    description:
      "Scaffold a product feature module with optional query, mutation, form, and test shells.",
    usage: "atlas generate feature <name> [options]",
    targetOwnership: "Consumer product feature root from the resolved Atlas project contract.",
    conflictBehavior:
      "Fails when generator-owned files already exist. Does not overwrite existing feature shells.",
    arguments: [
      {
        name: "name",
        required: true,
        description: "Feature name in kebab-case (example: billing-history).",
      },
    ],
    flags: [
      {
        flag: "--query",
        description: "Include query key factory and query hook scaffold.",
        appliesTo: "feature",
      },
      { flag: "--mutation", description: "Include mutation hook scaffold.", appliesTo: "feature" },
      {
        flag: "--form",
        description: "Include Zod schema and form component scaffold.",
        appliesTo: "feature",
      },
      {
        flag: "--tests",
        description: "Include deterministic query-key tests (requires --query).",
        appliesTo: "feature",
      },
      {
        flag: "--dry-run",
        description: "Preview planned file actions without writing.",
        appliesTo: "all",
      },
      { flag: "--json", description: "Emit machine-readable JSON on stdout.", appliesTo: "all" },
    ],
  },
  {
    id: "page",
    description:
      "Scaffold a thin App Router page shell under the configured application routes root.",
    usage: "atlas generate page <route> [options]",
    targetOwnership: "Application routes root from the resolved Atlas project contract.",
    conflictBehavior:
      "Fails when the target page file already exists. Does not overwrite existing route shells.",
    arguments: [
      {
        name: "route",
        required: true,
        description: "Route relative to the App Router root (example: settings/profile).",
      },
    ],
    flags: [
      {
        flag: "--dry-run",
        description: "Preview planned file actions without writing.",
        appliesTo: "all",
      },
      { flag: "--json", description: "Emit machine-readable JSON on stdout.", appliesTo: "all" },
    ],
  },
];

export function listGeneratorDefinitions(): GeneratorDefinition[] {
  return GENERATOR_DEFINITIONS.map((definition) => ({
    ...definition,
    arguments: [...definition.arguments],
    flags: [...definition.flags],
  }));
}
