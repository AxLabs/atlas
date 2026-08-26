import { buildAgentContextReport } from "../context/agent-context";
import { createAtlasContext } from "../context/atlas-context";
import { ExitCode } from "../exit-codes";
import { writeCommandSuccess } from "../output/write";

import type { AgentContextReport } from "../context/agent-context";
import type { OutputWriter } from "../output/write";

export function runContextCommand(options: {
  cwd?: string;
  json: boolean;
  writer: OutputWriter;
}): number {
  const context = createAtlasContext({
    cwd: options.cwd,
    requireProject: true,
  });

  const report = buildAgentContextReport(context);

  writeCommandSuccess(
    options.writer,
    "context",
    report,
    options.json,
    formatAgentContextHumanReport
  );

  return ExitCode.SUCCESS;
}

export function formatAgentContextHumanReport(report: AgentContextReport): string[] {
  const lines = [
    "Atlas agent context",
    "",
    `Atlas version: ${report.atlasVersion}`,
    `Canonical application: ${report.project.canonicalApplication ?? "unknown"}`,
    `Applications: ${report.project.applications.join(", ") || "none"}`,
    "",
    "Discover project state:",
    "  pnpm atlas context --json",
    "",
    "Structural scaffolding:",
    "  pnpm atlas generate feature <name> [--query] [--mutation] [--form] [--tests]",
    "  pnpm atlas generate page <route>",
    "  pnpm atlas generate list --json",
    "",
    "Architecture validation:",
    "  pnpm atlas doctor",
    "  pnpm atlas doctor --json",
    "",
    "Upgrade planning:",
    "  pnpm atlas upgrade --to <version> --dry-run --json",
    "",
    `Workflow documentation: ${report.documentation.workflow}`,
    `Agent entry point: ${report.documentation.agentEntryPoint}`,
  ];

  return lines;
}

export function writeContextHelp(writer: OutputWriter, json: boolean): void {
  const lines = [
    "Atlas context — resolved project state for humans and coding agents",
    "",
    "Emits a deterministic projection of the Atlas project contract, ownership manifest,",
    "generator inventory, Doctor capabilities, upgrade semantics, validation commands,",
    "and canonical documentation references.",
    "",
    "Usage:",
    "  atlas context [options]",
    "",
    "Options:",
    "  --json           Emit machine-readable JSON on stdout",
    "  --cwd <path>     Resolve the Atlas repository from a starting directory",
    "",
    "See docs/how-we-build/agents.md for the canonical agent workflow.",
  ];

  if (json) {
    writer.writeStdout(
      JSON.stringify({
        ok: true,
        command: "context-help",
        result: { lines },
      })
    );
    return;
  }

  for (const line of lines) {
    writer.writeStdout(line);
  }
}
