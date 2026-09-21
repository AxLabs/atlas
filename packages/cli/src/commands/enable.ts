import { enableConsumerCapability, listConsumerCapabilities } from "../enable/apply";
import { listCapabilityDefinitions } from "../enable/registry";
import { CliError, CliErrorCode } from "../errors/cli-error";
import { ExitCode } from "../exit-codes";
import { writeCommandSuccess } from "../output/write";

import type { OutputWriter } from "../output/write";

export interface ParsedEnableArgs {
  kind: "list" | "enable";
  capability: string;
  cwd?: string;
  dryRun: boolean;
  json: boolean;
}

export function parseEnableArgs(argv: string[]): ParsedEnableArgs {
  const parsed: ParsedEnableArgs = {
    kind: "enable",
    capability: "",
    dryRun: false,
    json: false,
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
        throw new CliError(CliErrorCode.USAGE_ERROR, "enable-help");
      case "--json":
        parsed.json = true;
        break;
      case "--dry-run":
        parsed.dryRun = true;
        break;
      case "--cwd": {
        const value = argv[index + 1];
        if (!value || value.startsWith("-")) {
          throw new CliError(CliErrorCode.USAGE_ERROR, "Missing value for --cwd");
        }
        parsed.cwd = value;
        index += 1;
        break;
      }
      default:
        if (arg.startsWith("-")) {
          throw new CliError(CliErrorCode.USAGE_ERROR, `Unknown option: ${arg}`);
        }
        positional.push(arg);
        break;
    }
  }

  if (positional.length === 0 || positional[0] === "list") {
    if (positional.length > 1) {
      throw new CliError(
        CliErrorCode.USAGE_ERROR,
        `Unexpected arguments: ${positional.slice(1).join(" ")}`
      );
    }
    parsed.kind = "list";
    return parsed;
  }

  if (positional.length > 1) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `Unexpected arguments: ${positional.slice(1).join(" ")}`
    );
  }

  parsed.capability = positional[0] ?? "";
  return parsed;
}

export function runEnableCommand(options: {
  parsed: ParsedEnableArgs;
  writer: OutputWriter;
}): number {
  if (options.parsed.kind === "list") {
    const result = listConsumerCapabilities({ cwd: options.parsed.cwd });
    writeCommandSuccess(options.writer, "enable list", result, options.parsed.json, (value) => [
      "Atlas consumer capabilities",
      "",
      `Workspace: ${value.workspaceKind}`,
      `Atlas version: ${value.atlasVersion}`,
      "",
      ...value.capabilities.map((capability) => {
        const heavier = capability.heavier ? " (heavier)" : "";
        return `- ${capability.id}: ${capability.status}${heavier} — ${capability.title}`;
      }),
      "",
      value.statusMeaning,
      "",
      "Validate with the capability's validationCommand; file presence is not a passing test.",
      "Enable with: atlas enable <id> [--dry-run]",
    ]);
    return ExitCode.SUCCESS;
  }

  const result = enableConsumerCapability({
    cwd: options.parsed.cwd,
    capability: options.parsed.capability,
    dryRun: options.parsed.dryRun,
  });

  writeCommandSuccess(options.writer, "enable", result, options.parsed.json, (value) => [
    options.parsed.dryRun ? "Atlas enable dry run." : "Atlas capability enablement finished.",
    `Capability: ${value.capability}`,
    `Project root: ${value.repoRoot}`,
    "Actions:",
    ...value.actions.map(
      (action) => `- ${action.kind}: ${action.path}${action.reason ? ` (${action.reason})` : ""}`
    ),
    ...(value.warnings.length > 0
      ? ["Warnings:", ...value.warnings.map((warning) => `- ${warning.message}`)]
      : []),
  ]);

  return ExitCode.SUCCESS;
}

export function writeEnableHelp(writer: OutputWriter, json: boolean): void {
  const ids = listCapabilityDefinitions()
    .map((capability) => capability.id)
    .join("|");
  const lines = [
    "Atlas enable — opt-in consumer tooling",
    "",
    "Copies packaged, portable tooling into an existing Atlas project without",
    "overwriting customized files. Heavier capabilities (Storybook, visual tests,",
    "performance CI) stay opt-in. Default init already includes Doctor, lint,",
    "typecheck, tests, and production build.",
    "",
    "Usage:",
    "  atlas enable list [options]",
    `  atlas enable <${ids}> [options]`,
    "",
    "Options:",
    "  --dry-run        Preview planned file actions without writing",
    "  --json           Emit machine-readable JSON on stdout",
    "  --cwd <path>     Resolve the Atlas project from this directory",
    "",
    "Examples:",
    "  atlas enable list --json",
    "  atlas enable storybook --dry-run",
    "  atlas enable docs",
  ];

  if (json) {
    writer.writeStdout(
      JSON.stringify({
        ok: true,
        command: "enable-help",
        result: { lines },
      })
    );
    return;
  }

  for (const line of lines) {
    writer.writeStdout(line);
  }
}
