import { AtlasContractError } from "@atlas/project";

import { createAtlasContext } from "../context/atlas-context";
import { ExitCode } from "../exit-codes";
import { CliErrorCode } from "../errors/cli-error";
import { createMinimalAtlasFixture } from "./helpers/fixture";

describe("Atlas CLI context", () => {
  it("maps invalid atlas.config.json to actionable CLI errors", () => {
    const fixture = createMinimalAtlasFixture({ invalidContract: true });

    try {
      createAtlasContext({ cwd: fixture.root });
      throw new Error("Expected context creation to fail");
    } catch (error) {
      expect(error).toMatchObject({
        code: CliErrorCode.CONTRACT_INVALID,
        exitCode: ExitCode.CONTRACT_INVALID,
      });
      expect((error as Error).message).toContain("invalid JSON");
      expect(error).not.toBeInstanceOf(AtlasContractError);
    }
  });
});
