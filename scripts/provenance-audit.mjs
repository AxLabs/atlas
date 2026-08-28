import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(scriptDir, "..");

function resolveRepoRoot(root) {
  return root ?? process.env.ATLAS_REPO_ROOT ?? defaultRepoRoot;
}

export const BINARY_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
  ".ico",
  ".avif",
  ".pdf",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".webm",
  ".mp4",
  ".wasm",
  ".zip",
  ".tar",
  ".gz",
  ".7z",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
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
    label: "Largest historical blobs (all objects, extension classified afterward)",
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

export class ShallowRepositoryError extends Error {
  constructor() {
    super("Historical provenance audit requires a full Git clone.");
    this.name = "ShallowRepositoryError";
  }
}

export function isBinaryPath(filePath) {
  const lower = filePath.toLowerCase();
  return BINARY_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function classifyHistoricalPath(filePath) {
  if (isBinaryPath(filePath)) {
    return "asset-extension";
  }

  if (!filePath.includes(".")) {
    return "extensionless";
  }

  return "other";
}

export function filterDeletedBinaryAssets(lines) {
  return [...new Set(lines.filter(Boolean).filter(isBinaryPath))].sort();
}

export function parseRevListObjects(revListOutput) {
  const objects = [];

  for (const line of revListOutput.split("\n")) {
    if (!line) {
      continue;
    }

    const spaceIndex = line.indexOf(" ");
    if (spaceIndex === -1) {
      continue;
    }

    objects.push({
      sha: line.slice(0, spaceIndex),
      path: line.slice(spaceIndex + 1),
    });
  }

  return objects;
}

export function rankHistoricalBlobs(objects, batchCheckOutput, limit = 20) {
  const pathBySha = new Map(objects.map((object) => [object.sha, object.path]));
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

    ranked.push({
      size,
      path: objectPath,
      classification: classifyHistoricalPath(objectPath),
    });
  }

  return ranked
    .sort((left, right) => right.size - left.size || left.path.localeCompare(right.path))
    .slice(0, limit)
    .map(
      ({ size, path: objectPath, classification }) =>
        `${size} ${objectPath} [${classification}]`,
    );
}

export function formatGitCommand(args) {
  return `git ${args.map((arg) => (/\s/.test(arg) ? `'${arg}'` : arg)).join(" ")}`;
}

export function createRunGitOrThrow(execFileSyncImpl, defaultRoot = defaultRepoRoot) {
  return function runGitOrThrow(args, options = {}) {
    const cwd = options.cwd ?? defaultRoot;

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

export function isShallowRepository(options = {}) {
  const runGit = resolveRunGit(options);
  const output = runGit(["rev-parse", "--is-shallow-repository"], options);
  return output.trim() === "true";
}

export function assertFullGitHistory(options = {}) {
  if (isShallowRepository(options)) {
    throw new ShallowRepositoryError();
  }
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
  const objects = parseRevListObjects(revListOutput);

  if (objects.length === 0) {
    return [];
  }

  const batchInput = `${objects.map((object) => object.sha).join("\n")}\n`;
  const batchOutput = runGit(CAT_FILE_BATCH_CHECK_ARGS, {
    ...options,
    input: batchInput,
  });

  return rankHistoricalBlobs(objects, batchOutput);
}

export function formatHistoryOutput(items) {
  return items.length > 0 ? items.join("\n") : "(no matches)";
}

export function runHistoryEvidence(checks = HISTORY_CHECKS, options = {}) {
  assertFullGitHistory(options);

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
        error,
      });
    }
  }

  return failures;
}

function fail(errors, message) {
  errors.push(message);
}

function gitTrackedFiles(root) {
  return execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function loadReviewedAssets(root = repoRoot) {
  const filePath = path.join(root, "reviewed-assets.json");
  if (!existsSync(filePath)) {
    return {};
  }

  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  return raw.assets ?? {};
}

export function validateReviewedAsset(pathKey, entry) {
  const errors = [];
  const requiredFields = ["sha256", "origin", "license", "reason", "reviewedOn"];

  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return [`${pathKey}: reviewed asset must be an object`];
  }

  for (const field of requiredFields) {
    if (typeof entry[field] !== "string" || entry[field].trim().length === 0) {
      errors.push(`${pathKey}: ${field} must be a non-empty string`);
    }
  }

  return errors;
}

function checkRequiredDocumentation(errors, root) {
  for (const relativePath of REQUIRED_NOTICE_FILES) {
    if (!existsSync(path.join(root, relativePath))) {
      fail(errors, `Missing provenance documentation: ${relativePath}`);
    }
  }
}

function checkCommittedBinaryAssets(errors, root) {
  const tracked = gitTrackedFiles(root);
  const reviewedAssets = loadReviewedAssets(root);
  const unreviewed = [];

  for (const file of tracked) {
    if (!isBinaryPath(file)) {
      continue;
    }

    const review = reviewedAssets[file];
    if (!review) {
      unreviewed.push(file);
      continue;
    }

    const reviewErrors = validateReviewedAsset(file, review);
    if (reviewErrors.length > 0) {
      for (const reviewError of reviewErrors) {
        fail(errors, reviewError);
      }
      continue;
    }

    const absolutePath = path.join(root, file);
    if (!existsSync(absolutePath)) {
      fail(errors, `Reviewed asset path does not exist at HEAD: ${file}`);
      continue;
    }

    const actualHash = sha256File(absolutePath);
    if (actualHash !== review.sha256) {
      fail(
        errors,
        `Reviewed asset hash mismatch for ${file}: expected ${review.sha256}, found ${actualHash}`,
      );
    }
  }

  if (unreviewed.length > 0) {
    fail(
      errors,
      `Committed binary/static assets require an entry in reviewed-assets.json: ${unreviewed.join(", ")}`,
    );
  }
}

function checkVendoredDirectories(errors, root) {
  const tracked = gitTrackedFiles(root);
  const suspicious = tracked.filter((file) =>
    /(^|\/)(vendor|vendored|third_party|third-party)(\/|$)/i.test(file),
  );

  if (suspicious.length > 0) {
    fail(errors, `Possible vendored source paths require provenance review: ${suspicious.join(", ")}`);
  }
}

function checkStaleRadixDeclarations(errors, root) {
  const uiManifest = path.join(root, "packages/ui/package.json");
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

function checkLicenseConsistency(errors, root) {
  const licensePath = path.join(root, "LICENSE");
  if (!existsSync(licensePath)) {
    fail(errors, "Missing root LICENSE file");
    return;
  }

  const license = readFileSync(licensePath, "utf8");
  if (!license.includes("Apache License") || !license.includes("Version 2.0")) {
    fail(errors, "Root LICENSE is not Apache-2.0");
  }
}

function printShallowCloneRemediation() {
  console.error("Historical provenance audit requires a full Git clone.");
  console.error("Fetch complete history before rerunning:");
  console.error("  git fetch --unshallow --tags");
}

function printHistoryEvidence() {
  console.log("\nHistorical audit evidence (read-only):\n");

  try {
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
  } catch (error) {
    if (error instanceof ShallowRepositoryError) {
      printShallowCloneRemediation();
      process.exit(1);
    }
    throw error;
  }
}

export function runCurrentTreeProvenanceCheck({ root = defaultRepoRoot } = {}) {
  const repoRoot = resolveRepoRoot(root);
  const errors = [];

  checkRequiredDocumentation(errors, repoRoot);
  checkCommittedBinaryAssets(errors, repoRoot);
  checkVendoredDirectories(errors, repoRoot);
  checkStaleRadixDeclarations(errors, repoRoot);
  checkLicenseConsistency(errors, repoRoot);

  return errors;
}

function main() {
  const historyOnly = process.argv.includes("--history");

  if (historyOnly) {
    printHistoryEvidence();
    return;
  }

  const errors = runCurrentTreeProvenanceCheck();

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
