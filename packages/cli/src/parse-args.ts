import { CliError, CliErrorCode } from "./errors/cli-error";

export interface ParsedCli {
  command?: string;
  cwd?: string;
  debug: boolean;
  dryRun: boolean;
  env: "skip" | "copy";
  help: boolean;
  json: boolean;
  reference: "keep" | "remove";
  version: boolean;
  positionals: string[];
}

function parseFlagValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    throw new CliError(CliErrorCode.USAGE_ERROR, `Missing value for ${flag}`);
  }

  return value;
}

function parseReference(value: string): "keep" | "remove" {
  if (value === "keep" || value === "remove") {
    return value;
  }

  throw new CliError(
    CliErrorCode.USAGE_ERROR,
    `Invalid value for --reference: ${value}. Expected keep or remove.`
  );
}

function parseEnv(value: string): "skip" | "copy" {
  if (value === "skip" || value === "copy") {
    return value;
  }

  throw new CliError(
    CliErrorCode.USAGE_ERROR,
    `Invalid value for --env: ${value}. Expected skip or copy.`
  );
}

export function parseCliArgs(argv: string[]): ParsedCli {
  const parsed: ParsedCli = {
    debug: false,
    dryRun: false,
    env: "skip",
    help: false,
    json: false,
    reference: "keep",
    version: false,
    positionals: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) {
      continue;
    }

    switch (arg) {
      case "--help":
      case "-h":
        parsed.help = true;
        break;
      case "--version":
      case "-v":
        parsed.version = true;
        break;
      case "--json":
        parsed.json = true;
        break;
      case "--debug":
        parsed.debug = true;
        break;
      case "--dry-run":
        parsed.dryRun = true;
        break;
      case "--cwd":
        parsed.cwd = parseFlagValue(argv, index, "--cwd");
        index += 1;
        break;
      case "--reference":
        parsed.reference = parseReference(parseFlagValue(argv, index, "--reference"));
        index += 1;
        break;
      case "--env":
        parsed.env = parseEnv(parseFlagValue(argv, index, "--env"));
        index += 1;
        break;
      default:
        if (arg.startsWith("-")) {
          throw new CliError(CliErrorCode.USAGE_ERROR, `Unknown option: ${arg}`);
        }
        parsed.positionals.push(arg);
        break;
    }
  }

  if (parsed.positionals.length > 0) {
    parsed.command = parsed.positionals[0];
  }

  if (parsed.positionals.length > 1) {
    throw new CliError(
      CliErrorCode.USAGE_ERROR,
      `Unexpected arguments: ${parsed.positionals.slice(1).join(" ")}`
    );
  }

  return parsed;
}
