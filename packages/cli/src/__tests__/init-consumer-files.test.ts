import { formatInitResult } from "../commands/init";
import { buildConsumerPackageManifest, buildConsumerReadme } from "../init/consumer-files";

describe("generated consumer workspace files", () => {
  it("keeps api:gen and omits dangling Atlas CLI and git-dependent scripts", () => {
    const manifest = JSON.parse(
      buildConsumerPackageManifest({
        projectName: "my-app",
        atlasVersion: "0.3.0",
      })
    ) as { version: string; scripts: Record<string, string> };

    expect(manifest.version).toBe("0.1.0");
    expect(manifest.scripts["api:gen"]).toBe("pnpm --filter @atlas/web api:gen");
    expect(manifest.scripts.atlas).toBeUndefined();
    expect(manifest.scripts["template:check"]).toBeUndefined();
    expect(manifest.scripts["template:sync"]).toBeUndefined();
    expect(manifest.scripts["api:check"]).toBeUndefined();
    expect(JSON.stringify(manifest.scripts)).not.toContain("git diff");
  });

  it("documents only commands the generated project owns", () => {
    const atlasVersion = "0.3.0";
    const readme = buildConsumerReadme({
      projectName: "my-app",
      atlasVersion,
    });

    expect(readme).toContain("pnpm install");
    expect(readme).toContain("pnpm dev");
    expect(readme).toContain(`pnpm dlx @blitzcraftlabs/atlas@${atlasVersion} doctor`);
    expect(readme).not.toContain("pnpm dlx @blitzcraftlabs/atlas doctor");
    expect(readme).toContain(".github/workflows/ci.yml");
    expect(readme).toContain("GitHub-hosted Ubuntu");
    expect(readme).toContain("does not use BlitzCraft infrastructure");
    expect(readme).toContain(
      "https://github.com/blitzcraftlabs/atlas/blob/main/docs/public/README.md"
    );
    expect(readme).not.toContain("pnpm atlas -- doctor");
    expect(readme).not.toContain("pnpm atlas");
    expect(readme).not.toContain("package publication path is finalized");
    expect(readme).not.toContain("template:check");
    expect(readme).not.toContain("template:sync");
    expect(readme).not.toContain("api:check");
  });

  it("does not advertise an unsupported atlas command after bootstrap init", () => {
    const atlasVersion = "0.3.0";
    const lines = formatInitResult(
      {
        repoRoot: "/tmp/my-app",
        atlasVersion,
        initMode: "bootstrap",
        actions: [],
        warnings: [],
      },
      false
    ).join("\n");

    expect(lines).toContain("pnpm install");
    expect(lines).toContain("pnpm dev");
    expect(lines).toContain(`pnpm dlx @blitzcraftlabs/atlas@${atlasVersion} doctor`);
    expect(lines).not.toContain("pnpm dlx @blitzcraftlabs/atlas doctor");
    expect(lines).not.toContain("package publication path is finalized");
    expect(lines).not.toContain("pnpm atlas -- doctor");
    expect(lines).not.toContain("pnpm atlas");
  });
});
