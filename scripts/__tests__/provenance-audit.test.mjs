import assert from "node:assert/strict";
import { test } from "node:test";

import {
  GitCommandError,
  createRunGitOrThrow,
  filterDeletedBinaryAssets,
  findDeletedBinaryAssets,
  findHistoricalBinaryBlobs,
  findRadixHistory,
  formatHistoryOutput,
  parseRevListBinaryCandidates,
  rankHistoricalBinaryBlobs,
  runHistoryEvidence,
} from "../provenance-audit.mjs";

function createMockRunGit(responses) {
  return (args, options = {}) => {
    const key = args.join("\0");
    const response = responses[key];

    if (response === undefined) {
      throw new Error(`Unexpected git invocation: ${args.join(" ")}`);
    }

    if (response instanceof Error) {
      throw response;
    }

    if (typeof response === "function") {
      return response(args, options);
    }

    return response;
  };
}

test("formatHistoryOutput prints evidence or explicit no-match marker", () => {
  assert.equal(formatHistoryOutput(["assets/logo.svg"]), "assets/logo.svg");
  assert.equal(formatHistoryOutput([]), "(no matches)");
});

test("successful git command with matches prints evidence", () => {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(" "));

  try {
    const failures = runHistoryEvidence(
      [
        {
          label: "Deleted binary assets by extension",
          commands: [["log", "--all"]],
          run: () => ["assets/logo.svg"],
        },
      ],
      {},
    );

    assert.equal(failures.length, 0);
    assert.ok(logs.some((line) => line === "assets/logo.svg"));
    assert.ok(!logs.some((line) => line === "(no matches)"));
  } finally {
    console.log = originalLog;
  }
});

test("successful git command with no relevant matches prints (no matches)", () => {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(" "));

  try {
    const failures = runHistoryEvidence(
      [
        {
          label: "Radix-era UI migration",
          commands: [["log", "--all"]],
          run: () => [],
        },
      ],
      {},
    );

    assert.equal(failures.length, 0);
    assert.ok(logs.includes("(no matches)"));
  } finally {
    console.log = originalLog;
  }
});

test("git command failure fails audit and does not print (no matches)", () => {
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => errors.push(args.join(" "));

  try {
    const failures = runHistoryEvidence(
      [
        {
          label: "Deleted binary assets by extension",
          commands: [["log", "--all"]],
          run: () => {
            throw new GitCommandError(["log", "--all"], 128, "fatal: bad revision");
          },
        },
      ],
      {},
    );

    assert.equal(failures.length, 1);
    assert.equal(failures[0].exitCode, 128);
    assert.match(failures[0].stderr, /fatal: bad revision/);
    assert.ok(!errors.some((line) => line === "(no matches)"));
  } finally {
    console.error = originalError;
  }
});

test("upstream git producer failure cannot be interpreted as empty evidence", () => {
  assert.throws(
    () =>
      findDeletedBinaryAssets({
        runGit: () => {
          throw new GitCommandError(
            ["log", "--all", "--diff-filter=D", "--name-only", "--pretty=format:"],
            128,
            "fatal: bad revision",
          );
        },
      }),
    (error) => error instanceof GitCommandError && error.exitCode === 128,
  );

  const failures = runHistoryEvidence(
    [
      {
        label: "Deleted binary assets by extension",
        commands: [["log", "--all"]],
        run: () => {
          throw new GitCommandError(["log", "--all"], 128, "fatal: bad revision");
        },
      },
    ],
    {},
  );

  assert.equal(failures.length, 1);
  assert.notEqual(failures[0].exitCode, 0);
});

test("filterDeletedBinaryAssets dedupes, filters extensions, and sorts", () => {
  assert.deepEqual(
    filterDeletedBinaryAssets(["foo.ts", "old/image.png", "assets/logo.svg", "old/image.png"]),
    ["assets/logo.svg", "old/image.png"],
  );
});

test("rankHistoricalBinaryBlobs identifies binary paths, parses sizes, sorts, and limits", () => {
  const candidates = parseRevListBinaryCandidates(
    [
      "aaa111 packages/ui/design-system-screenshots/a.png",
      "bbb222 packages/ui/design-system-screenshots/b.png",
      "ccc333 README.md",
    ].join("\n"),
  );

  assert.equal(candidates.length, 2);

  const ranked = rankHistoricalBinaryBlobs(
    candidates,
    ["blob aaa111 34000", "blob bbb222 12000"].join("\n"),
    1,
  );

  assert.deepEqual(ranked, ["34000 packages/ui/design-system-screenshots/a.png"]);
});

test("findHistoricalBinaryBlobs checks rev-list and cat-file independently", () => {
  const calls = [];

  const items = findHistoricalBinaryBlobs({
    runGit: (args, options = {}) => {
      calls.push(args.join(" "));
      if (args[0] === "rev-list") {
        return "aaa111 assets/logo.png";
      }
      if (args[0] === "cat-file") {
        assert.equal(options.input, "aaa111\n");
        return "blob aaa111 4096";
      }
      throw new Error(`Unexpected git args: ${args.join(" ")}`);
    },
  });

  assert.deepEqual(items, ["4096 assets/logo.png"]);
  assert.deepEqual(calls, ["rev-list --objects --all", "cat-file --batch-check=%(objecttype) %(objectname) %(objectsize) %(rest)"]);
});

test("findRadixHistory returns non-empty lines from direct git output", () => {
  const items = findRadixHistory({
    runGit: () => "abc1234 feat(ui): migrate dialog\n",
  });

  assert.deepEqual(items, ["abc1234 feat(ui): migrate dialog"]);
});

test("createRunGitOrThrow surfaces git exit status and stderr", () => {
  const runGit = createRunGitOrThrow(() => {
    const error = new Error("git failed");
    error.status = 128;
    error.stderr = "fatal: bad revision";
    throw error;
  });

  assert.throws(
    () => runGit(["log", "--all"]),
    (error) =>
      error instanceof GitCommandError &&
      error.exitCode === 128 &&
      error.stderr === "fatal: bad revision",
  );
});

test("createRunGitOrThrow returns stdout for successful git commands", () => {
  const runGit = createRunGitOrThrow((_file, args) => {
    assert.deepEqual(args, ["log", "--oneline", "-1"]);
    return "abc1234 example\n";
  });

  assert.equal(runGit(["log", "--oneline", "-1"]), "abc1234 example");
});
