import type { CliError } from "../errors/cli-error";
import type { JsonEnvelope } from "../types/result";

export interface OutputWriter {
  writeStdout: (line: string) => void;
  writeStderr: (line: string) => void;
}

export function createOutputWriter(): OutputWriter {
  return {
    writeStdout: (line) => {
      process.stdout.write(`${line}\n`);
    },
    writeStderr: (line) => {
      process.stderr.write(`${line}\n`);
    },
  };
}

export function writeJson<T>(writer: OutputWriter, payload: JsonEnvelope<T>): void {
  writer.writeStdout(JSON.stringify(payload));
}

export function writeCommandError(
  writer: OutputWriter,
  command: string,
  error: CliError,
  json: boolean
): void {
  if (json) {
    writeJson(writer, {
      ok: false,
      command,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  writer.writeStderr(`Error: ${error.message}`);
  if (error.details?.length) {
    for (const detail of error.details) {
      writer.writeStderr(`  - ${detail}`);
    }
  }
}

export function writeCommandSuccess<T>(
  writer: OutputWriter,
  command: string,
  result: T,
  json: boolean,
  formatHuman: (result: T) => string[]
): void {
  if (json) {
    writeJson(writer, {
      ok: true,
      command,
      result,
    });
    return;
  }

  for (const line of formatHuman(result)) {
    writer.writeStdout(line);
  }
}

export function writeVersion(
  writer: OutputWriter,
  versionInfo: {
    atlasVersion: string;
    contractSchemaVersion: number;
    cliPackage: string;
  },
  json: boolean
): void {
  if (json) {
    writeJson(writer, {
      ok: true,
      command: "version",
      result: versionInfo,
    });
    return;
  }

  writer.writeStdout(versionInfo.atlasVersion);
}

export function writeHelp(writer: OutputWriter, json: boolean): void {
  const lines = [
    "Atlas CLI — Atlas-specific project workflows",
    "",
    "Atlas does not replace pnpm, Next.js, Turborepo, Git, or Changesets.",
    "Use those tools directly for package management, dev servers, tests, and releases.",
    "",
    "Usage:",
    "  atlas [options] <command>",
    "",
    "Options:",
    "  --cwd <path>     Run against an Atlas repository root (default: discover from cwd)",
    "  --debug          Include stack traces for unexpected errors",
    "  --dry-run        Preview planned changes without writing files",
    "  --help, -h       Show help",
    "  --json           Emit machine-readable JSON on stdout",
    "  --version, -v    Show Atlas platform version",
    "",
    "Commands:",
    "  init <project>   Create a new Atlas project from packaged bootstrap assets",
    "  init             Initialize Atlas metadata in an existing compatible checkout",
    "  generate         Generate Atlas feature modules and App Router pages",
    "  enable           Opt-in consumer tooling (Storybook, coverage, hooks, ...)",
    "  doctor           Diagnose Atlas architecture and configuration drift",
    "  sync             Synchronize duplicated template infrastructure between applications",
    "  upgrade          Plan and apply supported Atlas release upgrades",
    "  context          Emit resolved Atlas project context for humans and agents",
    "",
    "Init options:",
    "  --env <mode>         Environment setup: skip (default) or copy (.env.example → .env.local)",
    "  --reference <mode>   Checkout init only: keep (default) or remove reference content",
    "",
    "Examples:",
    "  atlas --help",
    "  atlas --version",
    "  atlas init my-app",
    "  atlas init",
    "  atlas init --dry-run --reference remove --env copy",
    "  atlas generate feature users --dry-run",
    "  atlas generate page settings/profile --json",
    "  atlas enable list --json",
    "  atlas enable storybook --dry-run",
    "  atlas doctor",
    "  atlas doctor --json",
    "  atlas context --json",
    "  pnpm atlas -- init --json",
  ];

  if (json) {
    writeJson(writer, {
      ok: true,
      command: "help",
      result: {
        summary: "Atlas CLI help",
        lines,
      },
    });
    return;
  }

  for (const line of lines) {
    writer.writeStdout(line);
  }
}
