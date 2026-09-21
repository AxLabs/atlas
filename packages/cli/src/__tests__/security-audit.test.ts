import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
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

describe("consumer security audit report validation", () => {
  function runSpawnedAudit(pnpmSource: string): { status: number; stdout: string; stderr: string } {
    const binDir = mkdtempSync(path.join(os.tmpdir(), "atlas-fake-pnpm-"));
    const pnpmPath = path.join(binDir, "pnpm");
    writeFileSync(pnpmPath, `#!/usr/bin/env node\n${pnpmSource}\n`);
    chmodSync(pnpmPath, 0o755);
    const result = spawnSync(process.execPath, [SCRIPT], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}` },
    });
    return {
      status: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  }

  it("rejects an exit-1 JSON error instead of treating it as a clean audit", () => {
    const result = runSpawnedAudit(`
process.stdout.write(JSON.stringify({
  error: { code: "ERR_PNPM_AUDIT", message: "registry unavailable" }
}) + "\\n");
process.exit(1);
`);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("pnpm audit returned an error");
    expect(result.stderr).toContain("registry unavailable");
    expect(result.stdout).not.toContain("No blocking high/critical advisories");
  });

  it("rejects a malformed or unrecognized report", () => {
    const cwd = mkdtempSync(path.join(os.tmpdir(), "atlas-security-audit-bad-"));
    const auditPath = path.join(cwd, "audit.json");
    writeFileSync(auditPath, "{not-json\n");
    const malformed = spawnSync(process.execPath, [SCRIPT, "--audit-json", auditPath], {
      encoding: "utf8",
    });
    expect(malformed.status ?? 1).toBe(1);
    expect(malformed.stderr ?? "").toMatch(/not valid JSON|malformed JSON/i);

    const unrecognized = runAudit({ foo: 1 });
    expect(unrecognized.status).toBe(1);
    expect(unrecognized.stderr).toContain("unrecognized audit report");
    expect(unrecognized.stdout).not.toContain("No blocking high/critical advisories");
  });

  it("accepts a valid clean vulnerability report", () => {
    const result = runAudit({
      vulnerabilities: {},
      metadata: { vulnerabilities: { high: 0, critical: 0 } },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("No blocking high/critical advisories");
  });

  it("fails closed when metadata is null", () => {
    const result = runAudit({ metadata: null });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("metadata must be an object");
    expect(result.stdout).not.toContain("No blocking high/critical advisories");
  });

  it("fails closed when metadata reports high issues with no evaluable findings", () => {
    const result = runAudit({ metadata: { vulnerabilities: { high: 1, critical: 0 } } });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/no evaluable high\/critical findings/);
    expect(result.stdout).not.toContain("No blocking high/critical advisories");
  });

  it("fails closed on a malformed vulnerabilities entry", () => {
    const result = runAudit({
      vulnerabilities: { "left-pad": null },
      metadata: { vulnerabilities: { high: 0, critical: 0 } },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/malformed/);
    expect(result.stdout).not.toContain("No blocking high/critical advisories");
  });

  it("evaluates a valid vulnerability report returned with exit 1", () => {
    const result = runSpawnedAudit(`
process.stdout.write(JSON.stringify({
  vulnerabilities: {
    "left-pad": {
      name: "left-pad",
      severity: "high",
      via: [{
        name: "left-pad",
        title: "synthetic",
        url: "https://github.com/advisories/GHSA-xxxx-yyyy-zzzz",
        severity: "high",
        range: "1.0.0"
      }],
      nodes: ["left-pad"]
    }
  },
  metadata: { vulnerabilities: { high: 1, critical: 0 } }
}) + "\\n");
process.exit(1);
`);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("left-pad");
    expect(result.stderr).toContain("GHSA-xxxx-yyyy-zzzz");
    expect(result.stdout).not.toContain("No blocking high/critical advisories");
  });

  it("still honors documented advisory exceptions on a valid report", () => {
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
});
