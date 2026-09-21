import { CLI_PACKAGE_NAME } from "../version";

/**
 * Published npm 1.1.0 does not include `atlas enable`. Until the next CLI version is
 * assigned, adoption docs use this placeholder. Replace it when that version ships.
 */
export const ENABLE_CLI_RELEASE_PLACEHOLDER = "<next-cli-release>";

/** CLI releases that exist on npm without the `enable` command. */
export const CLI_RELEASES_WITHOUT_ENABLE = new Set(["1.0.0", "1.0.1", "1.1.0"]);

export function atlasDlx(atlasVersion: string): string {
  return `pnpm dlx ${CLI_PACKAGE_NAME}@${atlasVersion}`;
}

/**
 * Invocation for `atlas enable`. Existing consumers may keep an older
 * `platform.baseline.atlasVersion`; enable lives on a newer CLI release.
 */
export function atlasDlxForEnable(atlasVersion: string): string {
  if (CLI_RELEASES_WITHOUT_ENABLE.has(atlasVersion)) {
    return `pnpm dlx ${CLI_PACKAGE_NAME}@${ENABLE_CLI_RELEASE_PLACEHOLDER}`;
  }
  return atlasDlx(atlasVersion);
}

export function enableCliInvocation(atlasVersion: string, kind: "platform" | "consumer"): string {
  if (kind === "platform") {
    return "pnpm atlas";
  }
  return atlasDlxForEnable(atlasVersion);
}
