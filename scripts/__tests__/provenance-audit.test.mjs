import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  GitCommandError,
  ShallowRepositoryError,
  assertFullGitHistory,
  classifyHistoricalPath,
  createRunGitOrThrow,
  filterDeletedBinaryAssets,
  findDeletedBinaryAssets,
  findHistoricalBinaryBlobs,
  findRadixHistory,
  formatHistoryOutput,
  isBinaryPath,
  isShallowRepository,
  loadReviewedAssets,
  parseRevListObjects,
  rankHistoricalBlobs,
  runHistoryEvidence,
  validateReviewedAsset,
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

function createTempGitRepo({ shallow = false, files = [], commits = 1 } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), "atlas-provenance-git-"));

  const runGit = (args, options = {}) =>
    execFileSync("git", args, {
      cwd: options.cwd ?? root,
      encoding: "utf8",
      input: options.input,
      stdio: ["pipe", "pipe", "pipe"],
    }).replace(/\n$/, "");

  runGit(["init"]);
  runGit(["config", "user.email", "test@example.com"]);
  runGit(["config", "user.name", "Test User"]);
  runGit(["config", "commit.gpgsign", "false"]);

  for (const [relativePath, contents] of files) {
    const absolutePath = path.join(root, relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, contents, "utf8");
    runGit(["add", relativePath]);
    runGit(["commit", "-m", `add ${relativePath}`]);
  }

  if (commits === 0) {
    runGit(["commit", "--allow-empty", "-m", "initial"]);
  }

  if (shallow) {
    const shallowRoot = mkdtempSync(path.join(os.tmpdir(), "atlas-provenance-shallow-"));
    execFileSync("git", ["clone", "--depth", "1", `file://${root}`, shallowRoot], {
      stdio: "pipe",
    });
    rmSync(root, { recursive: true, force: true });
    return {
      root: shallowRoot,
      cleanup: () => rmSync(shallowRoot, { recursive: true, force: true }),
      runGit: (args, options = {}) =>
        execFileSync("git", args, {
          cwd: options.cwd ?? shallowRoot,
          encoding: "utf8",
          input: options.input,
          stdio: ["pipe", "pipe", "pipe"],
        }).replace(/\n$/, ""),
    };
  }

  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
    runGit,
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
      {
        runGit: createMockRunGit({
          "rev-parse\0--is-shallow-repository": "false",
        }),
      },
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
      {
        runGit: createMockRunGit({
          "rev-parse\0--is-shallow-repository": "false",
        }),
      },
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
      {
        runGit: createMockRunGit({
          "rev-parse\0--is-shallow-repository": "false",
        }),
      },
    );

    assert.equal(failures.length, 1);
    assert.equal(failures[0].exitCode, 128);
    assert.match(failures[0].stderr, /fatal: bad revision/);
    assert.ok(!errors.some((line) => line === "(no matches)"));
  } finally {
    console.error = originalError;
  }
});

test("shallow repository refuses historical audit", () => {
  const repo = createTempGitRepo({ shallow: true, files: [["README.md", "hello\n"]] });

  try {
    assert.equal(isShallowRepository({ cwd: repo.root, runGit: repo.runGit }), true);
    assert.throws(
      () => assertFullGitHistory({ cwd: repo.root, runGit: repo.runGit }),
      ShallowRepositoryError,
    );
    assert.throws(
      () =>
        runHistoryEvidence(
          [
            {
              label: "Deleted binary assets by extension",
              commands: [["log", "--all"]],
              run: () => [],
            },
          ],
          { cwd: repo.root, runGit: repo.runGit },
        ),
      ShallowRepositoryError,
    );
  } finally {
    repo.cleanup();
  }
});

test("full repository allows historical audit", () => {
  const repo = createTempGitRepo({ shallow: false, files: [["README.md", "hello\n"]] });

  try {
    assert.equal(isShallowRepository({ cwd: repo.root, runGit: repo.runGit }), false);
    const failures = runHistoryEvidence(
      [
        {
          label: "Deleted binary assets by extension",
          commands: [["log", "--all"]],
          run: () => findDeletedBinaryAssets({ cwd: repo.root, runGit: repo.runGit }),
        },
      ],
      { cwd: repo.root, runGit: repo.runGit },
    );
    assert.equal(failures.length, 0);
  } finally {
    repo.cleanup();
  }
});

test("filterDeletedBinaryAssets dedupes, filters extensions, and sorts", () => {
  assert.deepEqual(
    filterDeletedBinaryAssets(["foo.ts", "old/image.png", "assets/logo.svg", "old/image.png"]),
    ["assets/logo.svg", "old/image.png"],
  );
});

test("rankHistoricalBlobs ranks all blobs and classifies paths afterward", () => {
  const objects = parseRevListObjects(
    [
      "aaa111 packages/ui/design-system-screenshots/a.png",
      "bbb222 packages/ui/design-system-screenshots/b.png",
      "ccc333 README.md",
      "ddd444 archive/data",
    ].join("\n"),
  );

  const ranked = rankHistoricalBlobs(
    objects,
    ["blob aaa111 34000", "blob bbb222 12000", "blob ccc333 9000", "blob ddd444 50000"].join(
      "\n",
    ),
    2,
  );

  assert.deepEqual(ranked, [
    "50000 archive/data [extensionless]",
    "34000 packages/ui/design-system-screenshots/a.png [asset-extension]",
  ]);
});

test("findHistoricalBinaryBlobs checks rev-list and cat-file independently", () => {
  const calls = [];

  const items = findHistoricalBinaryBlobs({
    runGit: (args, options = {}) => {
      calls.push(args.join(" "));
      if (args[0] === "rev-list") {
        return "aaa111 assets/logo.png\nbbb222 README.md";
      }
      if (args[0] === "cat-file") {
        assert.equal(options.input, "aaa111\nbbb222\n");
        return "blob aaa111 4096\nblob bbb222 1200";
      }
      throw new Error(`Unexpected git args: ${args.join(" ")}`);
    },
  });

  assert.ok(items.some((line) => line.includes("assets/logo.png")));
  assert.deepEqual(calls, [
    "rev-list --objects --all",
    "cat-file --batch-check=%(objecttype) %(objectname) %(objectsize) %(rest)",
  ]);
});

test("binary extension list includes common static asset formats", () => {
  assert.equal(isBinaryPath("logo.avif"), true);
  assert.equal(isBinaryPath("clip.webm"), true);
  assert.equal(isBinaryPath("module.wasm"), true);
  assert.equal(classifyHistoricalPath("README.md"), "other");
});

test("reviewed asset validation requires evidence fields", () => {
  const errors = validateReviewedAsset("assets/logo.svg", {});
  assert.ok(errors.some((error) => error.includes("sha256")));
  assert.ok(errors.some((error) => error.includes("origin")));
});

test("loadReviewedAssets returns empty map when no assets are reviewed", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "atlas-reviewed-assets-"));
  writeFileSync(path.join(root, "reviewed-assets.json"), '{"assets":{}}\n', "utf8");
  assert.deepEqual(loadReviewedAssets(root), {});
  rmSync(root, { recursive: true, force: true });
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
