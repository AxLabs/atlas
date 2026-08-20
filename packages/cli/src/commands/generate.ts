import { createAtlasContext, loadProjectContext } from "../context/atlas-context";
import { CliError, CliErrorCode } from "../errors/cli-error";
import { ExitCode } from "../exit-codes";
import {
  planFeatureGenerationForRepo,
  planPageGenerationForRepo,
  runGenerator,
} from "../generators/run";
import { writeCommandSuccess } from "../output/write";

import type { GenerationResult } from "../generators/types";
import type { OutputWriter } from "../output/write";

export type GenerateKind = "feature" | "page";

export interface ParsedGenerateArgs {
  kind: GenerateKind;
  target: string;
  cwd?: string;
  dryRun: boolean;
  json: boolean;
  query: boolean;
  mutation: boolean;
  form: boolean;
  tests: boolean;
}

export interface GenerateCommandOptions {
  parsed: ParsedGenerateArgs;
  writer: OutputWriter;
}

export function parseGenerateArgs(argv: string[]): ParsedGenerateArgs {
  const parsed: ParsedGenerateArgs = {
    kind: "feature",
    target: "",
    dryRun: false,
    json: false,
    query: false,
    mutation: false,
    form: false,
    tests: false,
  };

  const positional: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) {
      continue;
    }

    switch (arg) {
      case "--help":
      case "-h":
        throw new CliError(CliErrorCode.USAGE_ERROR, "generate-help");
      case "--json":
        parsed.json = true;
        break;
      case "--dry-run":
        parsed.dryRun = true;
        break;
      case "--cwd":
        parsed.cwd = parseFlagValue(argv, index, "--cwd");
        index += 1;
        break;
      case "--query":
        parsed.query = true;
        break;
      case "--mutation":
        parsed.mutation = true;
        break;
      case "--form":
        parsed.form = true;
        break;
      case "--tests":
        parsed.tests = true;
        break;
      default:
        if (arg.startsWith("-")) {
          throw new CliError(CliErrorCode.USAGE_ERROR, `Unknown option: ${arg}`);
        }
        positional.push(arg);
        break;
    }
  }

  if (positional.length === 0) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      "Missing generator type. Usage: atlas generate <feature|page> <name|route>"
    );
  }

  const kind = positional[0];
  if (kind !== "feature" && kind !== "page") {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `Unknown generator type: ${kind}. Expected feature or page.`
    );
  }

  parsed.kind = kind;

  if (positional.length < 2) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      kind === "feature"
        ? "Missing feature name. Usage: atlas generate feature <name>"
        : "Missing route. Usage: atlas generate page <route>"
    );
  }

  if (positional.length > 2) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `Unexpected arguments: ${positional.slice(2).join(" ")}`
    );
  }

  parsed.target = positional[1] ?? "";
  return parsed;
}

function parseFlagValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    throw new CliError(CliErrorCode.USAGE_ERROR, `Missing value for ${flag}`);
  }

  return value;
}

export function runGenerateCommand(options: GenerateCommandOptions): number {
  if (
    options.parsed.kind === "page" &&
    (options.parsed.query || options.parsed.mutation || options.parsed.form || options.parsed.tests)
  ) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      "Feature flags (--query, --mutation, --form, --tests) are only supported for feature generation."
    );
  }

  const context = createAtlasContext({
    cwd: options.parsed.cwd,
    requireProject: true,
  });
  const project = loadProjectContext(context);

  const plan =
    options.parsed.kind === "feature"
      ? planFeatureGenerationForRepo(context.repoRoot, project, {
          name: options.parsed.target,
          query: options.parsed.query,
          mutation: options.parsed.mutation,
          form: options.parsed.form,
          tests: options.parsed.tests,
        })
      : planPageGenerationForRepo(context.repoRoot, project, {
          route: options.parsed.target,
        });

  const result = runGenerator({
    context,
    dryRun: options.parsed.dryRun,
    plan,
  });

  writeCommandSuccess(
    options.writer,
    `generate ${options.parsed.kind}`,
    toPublicGenerationResult(result),
    options.parsed.json,
    (value: GenerationResult) => formatGenerateResult(value)
  );

  return ExitCode.SUCCESS;
}

export function formatGenerateResult(result: GenerationResult): string[] {
  const lines = [
    result.dryRun ? "Atlas generator dry run" : "Atlas generator applied",
    `Generator: ${result.generatorType}`,
    `Input: ${result.normalizedInput}`,
    `Target root: ${result.targetRoot}`,
    "",
    "Planned actions:",
  ];

  for (const action of result.actions) {
    if (action.kind === "create") {
      lines.push(`  create ${action.path}`);
    } else if (action.kind === "conflict") {
      lines.push(`  conflict ${action.path}`);
    } else {
      lines.push(`  ${action.kind} ${action.path}`);
    }
  }

  if (result.followUpActions.length > 0) {
    lines.push("", "Next steps:");
    for (const followUp of result.followUpActions) {
      lines.push(`  - ${followUp}`);
    }
  }

  return lines;
}

export function toPublicGenerationResult(result: GenerationResult): GenerationResult {
  return {
    ...result,
    repoRoot: ".",
  };
}

export function writeGenerateHelp(writer: OutputWriter, json: boolean): void {
  const lines = [
    "Atlas generators — deterministic feature and page scaffolding",
    "",
    "Usage:",
    "  atlas generate feature <name> [options]",
    "  atlas generate page <route> [options]",
    "",
    "Feature names must use kebab-case (example: billing-history).",
    "Routes are relative to the configured App Router root (example: settings/profile).",
    "",
    "Options:",
    "  --dry-run        Preview planned file actions without writing",
    "  --json           Emit machine-readable JSON on stdout",
    "  --query          Include query key factory and query hook scaffold",
    "  --mutation       Include mutation hook scaffold",
    "  --form           Include Zod schema and form component scaffold",
    "  --tests          Include feature tests (requires --query, --mutation, or --form)",
    "",
    "Examples:",
    "  atlas generate feature users",
    "  atlas generate feature billing-history --query --mutation",
    "  atlas generate page settings/profile --dry-run --json",
  ];

  if (json) {
    writer.writeStdout(
      JSON.stringify({
        ok: true,
        command: "generate",
        result: { summary: "Atlas generator help", lines },
      })
    );
    return;
  }

  for (const line of lines) {
    writer.writeStdout(line);
  }
}
