import { spawnSync } from "node:child_process";
import path from "node:path";

const packageRoot = path.resolve(__dirname, "../../..");
const cliEntry = path.join(packageRoot, "dist/cli.js");

export interface CliRunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export function runAtlasCli(args: string[], cwd?: string): CliRunResult {
  const result = spawnSync(process.execPath, [cliEntry, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      NO_COLOR: "1",
      FORCE_COLOR: "0",
    },
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.status,
  };
}

export function getRepoRoot(): string {
  return path.resolve(packageRoot, "../..");
}
