import { readFileSync } from "node:fs";
import path from "node:path";

import { CLI_PACKAGE_NAME } from "../version";

const PACKAGE_ROOT = path.resolve(__dirname, "../..");
const manifest = JSON.parse(readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8")) as {
  name?: string;
  private?: boolean;
  license?: string;
  homepage?: string;
  bin?: Record<string, string>;
  files?: string[];
  engines?: { node?: string };
  repository?: { type?: string; url?: string; directory?: string };
  bugs?: { url?: string };
  publishConfig?: { access?: string };
  dependencies?: Record<string, string>;
};

describe("public CLI package identity", () => {
  it("is the public @blitzcraftlabs/atlas package with the atlas binary", () => {
    expect(CLI_PACKAGE_NAME).toBe("@blitzcraftlabs/atlas");
    expect(manifest.name).toBe(CLI_PACKAGE_NAME);
    expect(manifest.bin?.atlas).toBe("./dist/cli.js");
    expect(manifest.private).not.toBe(true);
    expect(manifest.publishConfig?.access).toBe("public");
  });

  it("points publication metadata at the canonical Atlas repository", () => {
    expect(manifest.license).toBe("Apache-2.0");
    expect(manifest.repository?.type).toBe("git");
    expect(manifest.repository?.url).toBe("git+https://github.com/blitzcraftlabs/atlas.git");
    expect(manifest.repository?.directory).toBe("packages/cli");
    expect(manifest.homepage).toBe("https://shipwithatlas.com");
    expect(manifest.bugs?.url).toBe("https://github.com/blitzcraftlabs/atlas/issues");
    expect(manifest.engines?.node).toBe(">=22.0.0");
  });

  it("keeps a strict files allowlist and no runtime workspace protocol", () => {
    expect(manifest.files).toEqual([
      "dist/**/*.js",
      "LICENSE",
      "assets/bootstrap/manifest.json",
      "assets/bootstrap/files/**",
    ]);
    expect(
      Object.values(manifest.dependencies ?? {}).some((range) => range.includes("workspace:"))
    ).toBe(false);
  });
});
