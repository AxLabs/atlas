import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { generateSpdxSbom, validateSpdxDocument } from "../generate-sbom.mjs";
import { runSyntheticSecretFixture } from "../gitleaks-fixture.mjs";
import {
  collectFindings,
  evaluateSecurityAudit,
  formatSecuritySummary,
  loadPolicy,
} from "../security-audit-policy.mjs";
import { findInvalidActionRefs, validateGithubWorkflows } from "../validate-github-workflows.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const cli = path.join(repoRoot, "scripts", "security-audit.mjs");
const fixtures = path.join(repoRoot, "scripts", "__fixtures__", "security");

function runCli(args) {
  try {
    const stdout = execFileSync(process.execPath, [cli, ...args], {
      encoding: "utf8",
      cwd: repoRoot,
    });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return {
      status: error.status ?? 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    };
  }
}

function writeExceptions(entries) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "atlas-security-exceptions-"));
  const filePath = path.join(directory, "exceptions.json");
  writeFileSync(filePath, `${JSON.stringify({ exceptions: entries }, null, 2)}\n`);
  return filePath;
}

function readFixture(name) {
  return JSON.parse(readFileSync(path.join(fixtures, name), "utf8"));
}

const emptyExceptions = writeExceptions([]);

const validException = {
  advisory: "GHSA-atls-high-0001",
  packageName: "atlas-synthetic-high",
  owner: "@atlas-maintainers",
  reason: "Synthetic fixture used to prove exception matching.",
  compensatingControl: "Not present in the lockfile; fixture-only.",
  reviewedOn: "2026-08-01",
  expiresOn: "2027-01-01",
};

describe("security audit CLI", () => {
  it("passes a clean audit fixture", () => {
    const result = runCli([
      "--audit-json",
      path.join(fixtures, "clean-audit.json"),
      "--exceptions",
      emptyExceptions,
    ]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /critical: 0/);
    assert.match(result.stdout, /high: 0/);
    assert.match(result.stdout, /✓ Dependency vulnerability policy passed/);
  });

  it("reports moderate findings without blocking", () => {
    const result = runCli([
      "--audit-json",
      path.join(fixtures, "moderate-vulnerability.json"),
      "--exceptions",
      emptyExceptions,
    ]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /moderate: 1/);
    assert.match(result.stdout, /blocking: 0/);
    assert.match(result.stdout, /Non-blocking findings/);
    assert.match(result.stdout, /GHSA-atls-modr-0001/);
    assert.match(result.stdout, /✓ Dependency vulnerability policy passed/);
  });

  it("fails on a synthetic HIGH vulnerability", () => {
    const result = runCli([
      "--audit-json",
      path.join(fixtures, "high-vulnerability.json"),
      "--exceptions",
      emptyExceptions,
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /blocking: 1/);
    assert.match(result.stdout, /GHSA-atls-high-0001/);
    assert.match(result.stdout, /✗ Dependency vulnerability policy failed/);
  });

  it("fails on a synthetic CRITICAL vulnerability", () => {
    const result = runCli([
      "--audit-json",
      path.join(fixtures, "critical-vulnerability.json"),
      "--exceptions",
      emptyExceptions,
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /critical: 1/);
    assert.match(result.stdout, /✗ Dependency vulnerability policy failed/);
  });

  it("permits an exact unexpired exception", () => {
    const exceptions = writeExceptions([validException]);
    const result = runCli([
      "--audit-json",
      path.join(fixtures, "high-vulnerability.json"),
      "--exceptions",
      exceptions,
      "--now",
      "2026-08-29",
    ]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /excepted: 1/);
    assert.match(result.stdout, /✓ Dependency vulnerability policy passed/);
  });

  it("fails when the matching exception is expired", () => {
    const exceptions = writeExceptions([{ ...validException, expiresOn: "2026-01-01" }]);
    const result = runCli([
      "--audit-json",
      path.join(fixtures, "high-vulnerability.json"),
      "--exceptions",
      exceptions,
      "--now",
      "2026-08-29",
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Expired exceptions/);
    assert.match(result.stdout, /✗ Dependency vulnerability policy failed/);
  });

  it("fails closed on a malformed exception", () => {
    const exceptions = writeExceptions([
      {
        advisory: "GHSA-atls-high-0001",
        packageName: "atlas-synthetic-high",
        owner: "@atlas-maintainers",
      },
    ]);
    const result = runCli([
      "--audit-json",
      path.join(fixtures, "high-vulnerability.json"),
      "--exceptions",
      exceptions,
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Malformed exceptions/);
  });

  it("fails when an exception is stale", () => {
    const exceptions = writeExceptions([validException]);
    const result = runCli([
      "--audit-json",
      path.join(fixtures, "clean-audit.json"),
      "--exceptions",
      exceptions,
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Stale exceptions/);
  });

  it("does not let advisory A suppress advisory B", () => {
    const exceptions = writeExceptions([
      {
        ...validException,
        advisory: "GHSA-atls-crit-0001",
        packageName: "atlas-synthetic-critical",
      },
    ]);
    const result = runCli([
      "--audit-json",
      path.join(fixtures, "high-vulnerability.json"),
      "--exceptions",
      exceptions,
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /GHSA-atls-high-0001/);
  });

  it("fails closed on missing audit data", () => {
    const result = runCli(["--audit-json", path.join(fixtures, "does-not-exist.json")]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /failed closed/);
  });

  it("fails closed on malformed audit JSON", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "atlas-bad-audit-"));
    const filePath = path.join(directory, "bad.json");
    writeFileSync(filePath, "{not-json");
    const result = runCli(["--audit-json", filePath]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /failed closed/);
  });

  it("fails closed on unknown severity instead of treating it as low", () => {
    const result = runCli([
      "--audit-json",
      path.join(fixtures, "unknown-severity.json"),
      "--exceptions",
      emptyExceptions,
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /failed closed/);
    assert.match(result.stderr, /unknown severity/);
    assert.doesNotMatch(result.stdout, /✓ Dependency vulnerability policy passed/);
  });

  it("fails closed on a malformed vulnerabilities entry", () => {
    const result = runCli([
      "--audit-json",
      path.join(fixtures, "malformed-vulnerability.json"),
      "--exceptions",
      emptyExceptions,
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /failed closed/);
    assert.match(result.stderr, /malformed/);
  });

  it("fails closed on a malformed advisories entry", () => {
    const result = runCli([
      "--audit-json",
      path.join(fixtures, "malformed-advisory.json"),
      "--exceptions",
      emptyExceptions,
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /failed closed/);
    assert.match(result.stderr, /malformed/);
  });

  it("fails closed on a malformed via entry", () => {
    const result = runCli([
      "--audit-json",
      path.join(fixtures, "malformed-via.json"),
      "--exceptions",
      emptyExceptions,
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /failed closed/);
    assert.match(result.stderr, /via record/);
  });

  it("fails closed on an unexpected recognized audit shape", () => {
    const result = runCli([
      "--audit-json",
      path.join(fixtures, "unexpected-audit-shape.json"),
      "--exceptions",
      emptyExceptions,
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /failed closed/);
    assert.match(result.stderr, /vulnerabilities must be an object/);
  });

  it("fails closed when metadata is null", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "atlas-bad-audit-"));
    const filePath = path.join(directory, "metadata-null.json");
    writeFileSync(filePath, `${JSON.stringify({ metadata: null })}\n`);
    const result = runCli(["--audit-json", filePath, "--exceptions", emptyExceptions]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /failed closed/);
    assert.match(result.stderr, /metadata must be an object/);
    assert.doesNotMatch(result.stdout, /✓ Dependency vulnerability policy passed/);
  });

  it("fails closed when metadata reports high issues with no evaluable findings", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "atlas-bad-audit-"));
    const filePath = path.join(directory, "metadata-high.json");
    writeFileSync(
      filePath,
      `${JSON.stringify({ metadata: { vulnerabilities: { high: 1, critical: 0 } } })}\n`
    );
    const result = runCli(["--audit-json", filePath, "--exceptions", emptyExceptions]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /failed closed/);
    assert.match(result.stderr, /no evaluable high\/critical findings/);
    assert.doesNotMatch(result.stdout, /✓ Dependency vulnerability policy passed/);
  });

  it("fails closed on an empty advisory record", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "atlas-bad-audit-"));
    const filePath = path.join(directory, "empty-advisory.json");
    writeFileSync(filePath, `${JSON.stringify({ advisories: { "1": {} } })}\n`);
    const result = runCli(["--audit-json", filePath, "--exceptions", emptyExceptions]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /failed closed/);
    assert.match(result.stderr, /unknown severity|missing a package name|does not identify/);
    assert.doesNotMatch(result.stdout, /✓ Dependency vulnerability policy passed/);
  });

  it("fails closed on a high vulnerability with no evaluable via entries", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "atlas-bad-audit-"));
    const filePath = path.join(directory, "empty-via-high.json");
    writeFileSync(
      filePath,
      `${JSON.stringify({ vulnerabilities: { example: { severity: "high", via: [] } } })}\n`
    );
    const result = runCli(["--audit-json", filePath, "--exceptions", emptyExceptions]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /failed closed/);
    assert.match(result.stderr, /no evaluable advisory entries/);
    assert.doesNotMatch(result.stdout, /✓ Dependency vulnerability policy passed/);
  });

  it("fails closed on missing severity", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "atlas-bad-audit-"));
    const filePath = path.join(directory, "missing-severity.json");
    writeFileSync(
      filePath,
      `${JSON.stringify({ vulnerabilities: { example: { via: [] } } })}\n`
    );
    const result = runCli(["--audit-json", filePath, "--exceptions", emptyExceptions]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /failed closed/);
    assert.match(result.stderr, /missing a known severity/);
    assert.doesNotMatch(result.stdout, /✓ Dependency vulnerability policy passed/);
  });

  it("resolves valid transitive string via references", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "atlas-audit-"));
    const filePath = path.join(directory, "transitive-via.json");
    writeFileSync(
      filePath,
      `${JSON.stringify({
        vulnerabilities: {
          parent: { name: "parent", severity: "high", via: ["atlas-synthetic-high"] },
          "atlas-synthetic-high": readFixture("high-vulnerability.json").vulnerabilities[
            "atlas-synthetic-high"
          ],
        },
      })}\n`
    );
    const result = runCli(["--audit-json", filePath, "--exceptions", emptyExceptions]);
    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.match(result.stdout, /blocking: 1/);
    assert.match(result.stdout, /GHSA-atls-high-0001/);
    assert.match(result.stdout, /✗ Dependency vulnerability policy failed/);
  });

  it("fails closed on unresolved via references", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "atlas-bad-audit-"));
    const filePath = path.join(directory, "unresolved-via.json");
    writeFileSync(
      filePath,
      `${JSON.stringify({ vulnerabilities: { parent: { severity: "high", via: ["missing"] } } })}\n`
    );
    const result = runCli(["--audit-json", filePath, "--exceptions", emptyExceptions]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /failed closed/);
    assert.match(result.stderr, /unresolved via reference "missing"/);
    assert.doesNotMatch(result.stdout, /✓ Dependency vulnerability policy passed/);
  });

  it("rejects wildcard exceptions", () => {
    const exceptions = writeExceptions([{ ...validException, advisory: "*" }]);
    const result = runCli([
      "--audit-json",
      path.join(fixtures, "high-vulnerability.json"),
      "--exceptions",
      exceptions,
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Malformed exceptions/);
  });
});

describe("security audit policy helpers", () => {
  it("collects the synthetic high finding", () => {
    const findings = collectFindings(readFixture("high-vulnerability.json"));
    assert.equal(findings.length, 1);
    assert.equal(findings[0].advisoryId, "GHSA-atls-high-0001");
  });

  it("formats a blocking summary", () => {
    const policy = loadPolicy(repoRoot);
    const evaluation = evaluateSecurityAudit({
      audit: readFixture("high-vulnerability.json"),
      exceptions: [],
      policy,
    });
    assert.equal(evaluation.ok, false);
    assert.match(formatSecuritySummary(evaluation, policy), /Blocking vulnerabilities/);
  });
});

describe("GitHub workflow security validator", () => {
  it("passes the current repository workflows", () => {
    const errors = validateGithubWorkflows(repoRoot);
    assert.deepEqual(errors, []);
  });

  it("rejects mutable and truncated remote action refs", () => {
    const failing = [
      "        uses: actions/checkout@v5\n",
      "        uses: actions/checkout@main\n",
      "        uses: vendor/action@stable\n",
      "        uses: vendor/action@release\n",
      "        uses: vendor/action@abcdef1\n",
    ];
    for (const content of failing) {
      const matches = findInvalidActionRefs(content);
      assert.equal(matches.length, 1, content);
    }
  });

  it("accepts exact SHA pins, action subpaths, and local actions", () => {
    const sha = "fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09";
    const passing = [
      `        uses: actions/checkout@${sha} # v5.1.0\n`,
      `        uses: owner/repo/subaction@${sha}\n`,
      "        uses: ./.github/actions/setup-atlas-ci\n",
    ];
    for (const content of passing) {
      const matches = findInvalidActionRefs(content);
      assert.equal(matches.length, 0, content);
    }
  });
});

describe("SBOM generation", () => {
  it("creates a valid SPDX document from the lockfile", () => {
    const sbom = generateSpdxSbom({
      root: repoRoot,
      commitSha: "testsha",
      createdAt: "2026-08-29T00:00:00Z",
    });
    assert.deepEqual(validateSpdxDocument(sbom), []);
    assert.ok(sbom.packages.length > 10);
    assert.equal(sbom.spdxVersion, "SPDX-2.3");
  });
});

describe("Gitleaks synthetic fixture", () => {
  it("detects a synthetic credential committed then deleted from git history", () => {
    const result = runSyntheticSecretFixture(repoRoot);
    if (result.error) {
      assert.equal(result.error.code, "ENOENT");
      assert.fail(`docker is required to prove Gitleaks detection: ${result.error.message}`);
    }
    assert.equal(result.worktreeHasSecret, false);
    assert.notEqual(result.status, 0);
  });
});
