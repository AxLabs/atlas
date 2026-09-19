import { toConsumerCiWorkflow } from "../bootstrap/consumer-ci";
import { BootstrapAssetError } from "../bootstrap/errors";

describe("consumer CI workflow transform", () => {
  it("pins the packaged CLI version for Doctor", () => {
    const rendered = toConsumerCiWorkflow(
      "run: pnpm dlx @blitzcraftlabs/atlas@{{ATLAS_CLI_VERSION}} doctor\n",
      "1.2.3"
    );
    expect(rendered).toBe("run: pnpm dlx @blitzcraftlabs/atlas@1.2.3 doctor\n");
  });

  it("rejects a missing placeholder or empty version", () => {
    expect(() => toConsumerCiWorkflow("run: pnpm lint\n", "1.2.3")).toThrow(BootstrapAssetError);
    expect(() =>
      toConsumerCiWorkflow("run: pnpm dlx @blitzcraftlabs/atlas@{{ATLAS_CLI_VERSION}} doctor\n", "")
    ).toThrow(BootstrapAssetError);
  });
});
