import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

export const BINARY_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
  ".ico",
  ".pdf",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
];

const REQUIRED_NOTICE_FILES = ["THIRD_PARTY_NOTICES.md", "docs/how-we-build/provenance.md"];

const DELETED_BINARY_GIT_ARGS = [
  "log",
  "--all",
  "--diff-filter=D",
  "--name-only",
  "--pretty=format:",
];

const RADIX_HISTORY_GIT_ARGS = [
  "log",
  "--all",
  "-S",
  "@radix-ui/react-dialog",
  "--oneline",
  "--",
  "packages/ui",
];

const REV_LIST_GIT_ARGS = ["rev-list", "--objects", "--all"];

const CAT_FILE_BATCH_CHECK_ARGS = [
  "cat-file",
  "--batch-check=%(objecttype) %(objectname) %(objectsize) %(rest)",
];

const HISTORY_CHECKS = [
  {
    label: "Deleted binary assets by extension",
    commands: [DELETED_BINARY_GIT_ARGS],
    run: findDeletedBinaryAssets,
  },
  {
    label: "Radix-era UI migration",
    commands: [RADIX_HISTORY_GIT_ARGS],
    run: findRadixHistory,
  },
  {
    label: "Largest historical binary blobs",
    commands: [REV_LIST_GIT_ARGS, CAT_FILE_BATCH_CHECK_ARGS],
    run: findHistoricalBinaryBlobs,
  },
];

export class GitCommandError extends Error {
  constructor(args, exitCode, stderr) {
    super(`git ${args.join(" ")} failed with exit ${exitCode}`);
    this.name = "GitCommandError";
    this.args = args;
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

export function isBinaryPath(filePath) {
  const lower = filePath.toLowerCase();
  return BINARY_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function filterDeletedBinaryAssets(lines) {
  return [...new Set(lines.filter(Boolean).filter(isBinaryPath))].sort();
}

export function parseRevListBinaryCandidates(revListOutput) {
  const candidates = [];

  for (const line of revListOutput.split("\n")) {
    if (!line) {
      continue;
    }

    const spaceIndex = line.indexOf(" ");
    if (spaceIndex === -1) {
      continue;
    }

    const objectPath = line.slice(spaceIndex + 1);
    if (!isBinaryPath(objectPath)) {
      continue;
    }

    candidates.push({
      sha: line.slice(0, spaceIndex),
      path: objectPath,
    });
  }

  return candidates;
}

export function rankHistoricalBinaryBlobs(candidates, batchCheckOutput, limit = 20) {
  const pathBySha = new Map(candidates.map((candidate) => [candidate.sha, candidate.path]));
  const ranked = [];

  for (const line of batchCheckOutput.split("\n")) {
    if (!line.startsWith("blob ")) {
      continue;
    }

    const parts = line.split(" ");
    const sha = parts[1];
    const size = Number(parts[2]);
    const objectPath = pathBySha.get(sha);

    if (!objectPath || Number.isNaN(size)) {
      continue;
    }

    ranked.push({ size, path: objectPath });
  }

  return ranked
    .sort((left, right) => right.size - left.size || left.path.localeCompare(right.path))
    .slice(0, limit)
    .map(({ size, path: objectPath }) => `${size} ${objectPath}`);
}

export function formatGitCommand(args) {
  return `git ${args.map((arg) => (/\s/.test(arg) ? `'${arg}'` : arg)).join(" ")}`;
}

export function createRunGitOrThrow(execFileSyncImpl) {
  return function runGitOrThrow(args, options = {}) {
    const cwd = options.cwd ?? repoRoot;

    try {
      return execFileSyncImpl("git", args, {
        cwd,
        encoding: "utf8",
        input: options.input,
        stdio: ["pipe", "pipe", "pipe"],
      }).replace(/\n$/, "");
    } catch (error) {
      throw new GitCommandError(
        args,
        typeof error.status === "number" ? error.status : 1,
        (error.stderr ?? "").toString(),
      );
    }
  };
}

const defaultRunGitOrThrow = createRunGitOrThrow(execFileSync);

function resolveRunGit(options) {
  return options.runGit ?? defaultRunGitOrThrow;
}

export function findDeletedBinaryAssets(options = {}) {
  const runGit = resolveRunGit(options);
  const output = runGit(DELETED_BINARY_GIT_ARGS, options);
  return filterDeletedBinaryAssets(output.split("\n"));
}

export function findRadixHistory(options = {}) {
  const runGit = resolveRunGit(options);
  const output = runGit(RADIX_HISTORY_GIT_ARGS, options);
  return output.split("\n").filter(Boolean);
}

export function findHistoricalBinaryBlobs(options = {}) {
  const runGit = resolveRunGit(options);
  const revListOutput = runGit(REV_LIST_GIT_ARGS, options);
  const candidates = parseRevListBinaryCandidates(revListOutput);

  if (candidates.length === 0) {
    return [];
  }

  const batchInput = `${candidates.map((candidate) => candidate.sha).join("\n")}\n`;
  const batchOutput = runGit(CAT_FILE_BATCH_CHECK_ARGS, {
    ...options,
    input: batchInput,
  });

  return rankHistoricalBinaryBlobs(candidates, batchOutput);
}

export function formatHistoryOutput(items) {
  return items.length > 0 ? items.join("\n") : "(no matches)";
}

export function runHistoryEvidence(checks = HISTORY_CHECKS, options = {}) {
  const failures = [];

  for (const check of checks) {
    try {
      const items = check.run(options);

      for (const args of check.commands) {
        console.log(`$ ${formatGitCommand(args)}`);
      }

      console.log(formatHistoryOutput(items));
      console.log("");
    } catch (error) {
      failures.push({
        commands: check.commands.map(formatGitCommand),
        stderr: error.stderr ?? error.message,
        exitCode: error.exitCode ?? 1,
      });
    }
  }

  return failures;
}

function fail(errors, message) {
  errors.push(message);
}

function gitTrackedFiles() {
  return execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

function checkRequiredDocumentation(errors) {
  for (const relativePath of REQUIRED_NOTICE_FILES) {
    if (!existsSync(path.join(repoRoot, relativePath))) {
      fail(errors, `Missing provenance documentation: ${relativePath}`);
    }
  }
}

function checkCommittedBinaryAssets(errors) {
  const tracked = gitTrackedFiles();
  const matches = tracked.filter((file) => isBinaryPath(file));

  if (matches.length > 0) {
    fail(
      errors,
      `Committed binary assets are not allowed at HEAD without provenance review: ${matches.join(", ")}`,
    );
  }
}

function checkVendoredDirectories(errors) {
  const tracked = gitTrackedFiles();
  const suspicious = tracked.filter((file) =>
    /(^|\/)(vendor|vendored|third_party|third-party)(\/|$)/i.test(file),
  );

  if (suspicious.length > 0) {
    fail(errors, `Possible vendored source paths require provenance review: ${suspicious.join(", ")}`);
  }
}

function checkStaleRadixDeclarations(errors) {
  const uiManifest = path.join(repoRoot, "packages/ui/package.json");
  if (!existsSync(uiManifest)) {
    return;
  }

  const pkg = JSON.parse(readFileSync(uiManifest, "utf8"));
  const sections = [pkg.dependencies, pkg.devDependencies, pkg.peerDependencies];

  for (const section of sections) {
    if (!section) {
      continue;
    }

    for (const name of Object.keys(section)) {
      if (name.startsWith("@radix-ui/") || name === "vaul") {
        fail(
          errors,
          `${name} is declared in @atlas/ui but Atlas UI uses Base UI primitives; remove stale declaration`,
        );
      }
    }
  }
}

function checkLicenseConsistency(errors) {
  const licensePath = path.join(repoRoot, "LICENSE");
  if (!existsSync(licensePath)) {
    fail(errors, "Missing root LICENSE file");
    return;
  }

  const license = readFileSync(licensePath, "utf8");
  if (!license.includes("Apache License") || !license.includes("Version 2.0")) {
    fail(errors, "Root LICENSE is not Apache-2.0");
  }
}

function printHistoryEvidence() {
  console.log("\nHistorical audit evidence (read-only):\n");

  const failures = runHistoryEvidence();

  if (failures.length > 0) {
    console.error("Historical audit command failed:\n");
    for (const failure of failures) {
      for (const command of failure.commands) {
        console.error(`$ ${command}`);
      }
      if (failure.stderr) {
        console.error(failure.stderr);
      }
      console.error(`Exit status: ${failure.exitCode}`);
      console.error("");
    }
    process.exit(1);
  }
}

function main() {
  const historyOnly = process.argv.includes("--history");

  if (historyOnly) {
    printHistoryEvidence();
    return;
  }

  const errors = [];

  checkRequiredDocumentation(errors);
  checkCommittedBinaryAssets(errors);
  checkVendoredDirectories(errors);
  checkStaleRadixDeclarations(errors);
  checkLicenseConsistency(errors);

  if (errors.length > 0) {
    console.error("Provenance audit failed:\n");
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log("✓ Current-tree provenance checks passed");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
