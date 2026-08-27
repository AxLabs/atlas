import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatHistoryOutput,
  runHistoryCommand,
} from "../provenance-audit.mjs";

test("history command success with output prints evidence", () => {
  const result = runHistoryCommand(
    { command: "echo 'match-one'", allowedExitCodes: [0] },
    {
      execSync: (command, options) => {
        assert.equal(command, "echo 'match-one'");
        assert.equal(options.encoding, "utf8");
        return "match-one\n";
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(formatHistoryOutput(result), "match-one");
});

test("history command success with no output prints (no matches)", () => {
  const result = runHistoryCommand(
    { command: "true", allowedExitCodes: [0] },
    {
      execSync: () => "",
    },
  );

  assert.equal(result.ok, true);
  assert.equal(formatHistoryOutput(result), "(no matches)");
});

test("expected grep-style no-match exit prints (no matches)", () => {
  const result = runHistoryCommand(
    { command: "grep pattern", allowedExitCodes: [0, 1] },
    {
      execSync: () => {
        const error = new Error("grep found nothing");
        error.status = 1;
        error.stdout = "";
        error.stderr = "";
        throw error;
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.exitCode, 1);
  assert.equal(formatHistoryOutput(result), "(no matches)");
});

test("unexpected command failure is fatal and not represented as (no matches)", () => {
  const result = runHistoryCommand(
    { command: "git rev-list --invalid", allowedExitCodes: [0, 1] },
    {
      execSync: () => {
        const error = new Error("invalid revision");
        error.status = 128;
        error.stdout = "";
        error.stderr = "fatal: bad revision";
        throw error;
      },
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.exitCode, 128);
  assert.equal(result.stderr, "fatal: bad revision");
  assert.equal(result.output, "");
});
