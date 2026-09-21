import { mkdtempSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const SCRIPT = path.resolve(__dirname, "../../bootstrap/capabilities/templates/security-audit.mjs");

function runAudit(
  audit: unknown,
  now = "2026-09-21"
): { status: number; stdout: string; stderr: string } {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "atlas-security-audit-"));
  const auditPath = path.join(cwd, "audit.json");
  writeFileSync(auditPath, `${JSON.stringify(audit)}\n`);
  const result = spawnSync(process.execPath, [SCRIPT, "--audit-json", auditPath, "--now", now], {
    encoding: "utf8",
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function advisory(options: {
  id: string;
  module: string;
  version: string;
  paths: string[];
  severity?: string;
}) {
  return {
    github_advisory_id: options.id,
    module_name: options.module,
    severity: options.severity ?? "high",
    title: `${options.module} advisory`,
    url: `https://github.com/advisories/${options.id}`,
    findings: [{ version: options.version, paths: options.paths }],
  };
}

describe("consumer security audit exceptions", () => {
  it("fails an unapproved high finding", () => {
    const result = runAudit({
      advisories: {
        "1": advisory({
          id: "GHSA-xxxx-yyyy-zzzz",
          module: "left-pad",
          version: "1.0.0",
          paths: ["left-pad"],
        }),
      },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("left-pad@1.0.0");
    expect(result.stderr).toContain("GHSA-xxxx-yyyy-zzzz");
  });

  it("ignores an exempt LHCI tmp finding when every path is under @lhci/cli", () => {
    const result = runAudit({
      advisories: {
        "1": advisory({
          id: "GHSA-ph9p-34f9-6g65",
          module: "tmp",
          version: "0.0.33",
          paths: ["node_modules/@lhci/cli>tmp"],
        }),
      },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Ignored 1");
  });

  it("fails an exempt advisory that is also reachable through a non-exempt path", () => {
    const result = runAudit({
      advisories: {
        "1": advisory({
          id: "GHSA-ph9p-34f9-6g65",
          module: "tmp",
          version: "0.0.33",
          paths: ["node_modules/@lhci/cli>tmp", "node_modules/@turbo/gen>inquirer>tmp"],
        }),
      },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("tmp@0.0.33");
    expect(result.stderr).toContain("GHSA-ph9p-34f9-6g65");
  });

  it("does not apply an expired exception", () => {
    const result = runAudit(
      {
        advisories: {
          "1": advisory({
            id: "GHSA-ph9p-34f9-6g65",
            module: "tmp",
            version: "0.0.33",
            paths: ["node_modules/@lhci/cli>tmp"],
          }),
        },
      },
      "2026-11-28"
    );
    expect(result.status).toBe(1);
  });
});
