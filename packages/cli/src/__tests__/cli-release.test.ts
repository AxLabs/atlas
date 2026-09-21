import {
  atlasDlxForEnable,
  cliReleaseIncludesEnable,
  ENABLE_CLI_RELEASE_PLACEHOLDER,
} from "../init/cli-release";

describe("atlas enable CLI version selection", () => {
  it("keeps the placeholder for published releases that lack enable", () => {
    expect(cliReleaseIncludesEnable("1.1.0")).toBe(false);
    expect(atlasDlxForEnable("1.1.0")).toBe(
      `pnpm dlx @blitzcraftlabs/atlas@${ENABLE_CLI_RELEASE_PLACEHOLDER}`
    );
    expect(atlasDlxForEnable("1.1.0", { runningCliVersion: "1.1.0" })).toBe(
      `pnpm dlx @blitzcraftlabs/atlas@${ENABLE_CLI_RELEASE_PLACEHOLDER}`
    );
  });

  it("pins enable to a running CLI that includes the command, not the consumer baseline", () => {
    expect(cliReleaseIncludesEnable("99.0.0")).toBe(true);
    expect(atlasDlxForEnable("1.1.0", { runningCliVersion: "99.0.0" })).toBe(
      "pnpm dlx @blitzcraftlabs/atlas@99.0.0"
    );
  });

  it("uses the init/CLI version when that release includes enable", () => {
    expect(atlasDlxForEnable("99.0.0")).toBe("pnpm dlx @blitzcraftlabs/atlas@99.0.0");
  });
});
