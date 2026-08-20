#!/usr/bin/env node

import { formatInitResult, runInit } from "./commands/init";
import { CliError, CliErrorCode, isCliError } from "./errors/cli-error";
import { cliErrorFromUnknown } from "./errors/from-contract";
import {
  createOutputWriter,
  writeCommandError,
  writeCommandSuccess,
  writeHelp,
  writeVersion,
} from "./output/write";
import { findAtlasRepoRoot } from "./project/find-root";
import { ExitCode } from "./exit-codes";
import { parseCliArgs, type ParsedCli } from "./parse-args";
import { readVersionMetadata } from "./version";

import type { CommandResult } from "./types/result";

export interface RunCliOptions {
  argv?: string[];
  cwd?: string;
  writer?: ReturnType<typeof createOutputWriter>;
}

function argvIncludesFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

export async function runCli(options: RunCliOptions = {}): Promise<number> {
  const argv = options.argv ?? process.argv.slice(2);
  const writer = options.writer ?? createOutputWriter();

  try {
    const parsed = parseCliArgs(argv);

    if (parsed.help) {
      writeHelp(writer, parsed.json);
      return ExitCode.SUCCESS;
    }

    if (parsed.version) {
      const startDir = parsed.cwd ?? options.cwd ?? process.cwd();
      const repoRoot = findAtlasRepoRoot(startDir) ?? process.cwd();
      writeVersion(writer, readVersionMetadata(repoRoot), parsed.json);
      return ExitCode.SUCCESS;
    }

    if (!parsed.command) {
      writeHelp(writer, parsed.json);
      return ExitCode.SUCCESS;
    }

    switch (parsed.command) {
      case "init":
        return runInitCommand(parsed, writer);
      default:
        throw new CliError(
          CliErrorCode.USAGE_ERROR,
          `Unknown command: ${parsed.command}. Run atlas --help for available commands.`
        );
    }
  } catch (error) {
    const cliError = cliErrorFromUnknown(
      error,
      argvIncludesFlag(argv, "--debug") || argvIncludesFlag(argv, "-d")
    );
    const command = extractCommand(argv);
    writeCommandError(writer, command, cliError, argvIncludesFlag(argv, "--json"));
    return cliError.exitCode;
  }
}

function runInitCommand(parsed: ParsedCli, writer: ReturnType<typeof createOutputWriter>): number {
  const result = runInit({
    cwd: parsed.cwd,
    dryRun: parsed.dryRun,
    env: parsed.env,
    reference: parsed.reference,
  });

  writeCommandSuccess(writer, "init", result, parsed.json, (value: CommandResult) =>
    formatInitResult(value, parsed.dryRun)
  );

  return ExitCode.SUCCESS;
}

function extractCommand(argv: string[]): string {
  const positional = argv.find((arg) => !arg.startsWith("-"));
  return positional ?? "atlas";
}

if (require.main === module) {
  void runCli()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      if (isCliError(error)) {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = error.exitCode;
        return;
      }

      process.stderr.write("Unexpected CLI failure.\n");
      process.exitCode = ExitCode.INTERNAL_ERROR;
    });
}
