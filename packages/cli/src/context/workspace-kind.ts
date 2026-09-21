import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { atlasDlx, enableCliInvocation } from "../init/cli-release";
import { CLI_PACKAGE_NAME } from "../version";

export type WorkspaceKind = "platform" | "consumer";

function readPackageName(packageJsonPath: string): string | undefined {
  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { name?: unknown };
    return typeof parsed.name === "string" ? parsed.name : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Platform checkouts vendor the CLI source workspace. Generated consumers do not.
 */
export function detectWorkspaceKind(repoRoot: string): WorkspaceKind {
  const cliPackageJsonPath = path.join(repoRoot, "packages", "cli", "package.json");
  if (existsSync(cliPackageJsonPath) && readPackageName(cliPackageJsonPath) === CLI_PACKAGE_NAME) {
    return "platform";
  }

  return "consumer";
}

export function atlasCliInvocation(atlasVersion: string, kind: WorkspaceKind): string {
  if (kind === "platform") {
    return "pnpm atlas";
  }

  return atlasDlx(atlasVersion);
}

export { enableCliInvocation };
