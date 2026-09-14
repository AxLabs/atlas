import { parseCliArgs } from "../parse-args";
import { CliError, CliErrorCode } from "../errors/cli-error";

describe("parseCliArgs init", () => {
  it("accepts atlas init <project>", () => {
    const parsed = parseCliArgs(["init", "my-app"]);
    expect(parsed.command).toBe("init");
    expect(parsed.initArgs).toEqual(["my-app"]);
    expect(parsed.positionals).toEqual(["init"]);
  });

  it("accepts a nested relative destination", () => {
    const parsed = parseCliArgs(["init", "nested/my-app"]);
    expect(parsed.command).toBe("init");
    expect(parsed.initArgs).toEqual(["nested/my-app"]);
  });

  it("keeps atlas init without a project as checkout mode", () => {
    const parsed = parseCliArgs(["init"]);
    expect(parsed.command).toBe("init");
    expect(parsed.initArgs).toEqual([]);
  });

  it("parses flags before and after init", () => {
    const before = parseCliArgs(["--json", "--dry-run", "init", "my-app"]);
    expect(before.command).toBe("init");
    expect(before.json).toBe(true);
    expect(before.dryRun).toBe(true);
    expect(before.initArgs).toEqual(["my-app"]);

    const after = parseCliArgs(["init", "my-app", "--json", "--env", "copy"]);
    expect(after.command).toBe("init");
    expect(after.json).toBe(true);
    expect(after.env).toBe("copy");
    expect(after.initArgs).toEqual(["my-app"]);

    const mixed = parseCliArgs(["--cwd", "/tmp", "init", "--dry-run", "nested/my-app"]);
    expect(mixed.command).toBe("init");
    expect(mixed.cwd).toBe("/tmp");
    expect(mixed.dryRun).toBe(true);
    expect(mixed.initArgs).toEqual(["nested/my-app"]);
  });

  it("collects multiple init arguments for the command to reject", () => {
    const parsed = parseCliArgs(["init", "one", "two"]);
    expect(parsed.command).toBe("init");
    expect(parsed.initArgs).toEqual(["one", "two"]);
  });

  it("does not loosen positional parsing for unrelated commands", () => {
    expect(() => parseCliArgs(["doctor", "extra"])).toThrow(CliError);
    try {
      parseCliArgs(["doctor", "extra"]);
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).code).toBe(CliErrorCode.USAGE_ERROR);
      expect((error as CliError).message).toContain("Unexpected arguments");
    }
  });
});
