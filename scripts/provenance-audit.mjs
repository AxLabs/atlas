import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const BINARY_EXTENSIONS = [
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

const HISTORY_CHECKS = [
  {
    label: "Deleted binary assets by extension",
    command:
      "git log --all --diff-filter=D --name-only --pretty=format: | sort -u | grep -E '\\.(png|jpg|jpeg|webp|gif|svg|ico|woff|woff2|ttf|otf|pdf)$'",
    allowedExitCodes: [0, 1],
  },
  {
    label: "Radix-era UI migration",
    command: "git log --all -S '@radix-ui/react-dialog' --oneline -- packages/ui",
    allowedExitCodes: [0],
  },
  {
    label: "Largest historical binary blobs",
    command:
      "git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | awk '/^blob/ && $4 ~ /\\.(png|jpg|jpeg|webp|gif|svg|ico|woff|woff2|ttf|otf|pdf)$/ {print $3, $4}' | sort -rn | head -20",
    allowedExitCodes: [0],
  },
];

function fail(errors, message) {
  errors.push(message);
}

function gitTrackedFiles() {
  return execSync("git ls-files", { cwd: repoRoot, encoding: "utf8" })
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
  const matches = tracked.filter((file) =>
    BINARY_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext)),
  );

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

/**
 * Execute a historical audit command and distinguish expected empty results from failures.
 *
 * @param {object} check
 * @param {string} check.command
 * @param {number[]} [check.allowedExitCodes=[0]]
 * @param {import("node:child_process").ExecSyncOptionsWithStringEncoding} [options]
 */
export function runHistoryCommand(check, options = {}) {
  const cwd = options.cwd ?? repoRoot;
  const exec = options.execSync ?? execSync;

  try {
    const output = exec(check.command, {
      cwd,
      encoding: "utf8",
      shell: options.shell ?? "/bin/bash",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();

    return {
      ok: true,
      output,
      exitCode: 0,
    };
  } catch (error) {
    const exitCode = typeof error.status === "number" ? error.status : 1;
    const stdout = (error.stdout ?? "").toString().trim();
    const stderr = (error.stderr ?? "").toString().trim();
    const allowedExitCodes = check.allowedExitCodes ?? [0];

    if (allowedExitCodes.includes(exitCode)) {
      return {
        ok: true,
        output: stdout,
        exitCode,
      };
    }

    return {
      ok: false,
      output: stdout,
      stderr,
      exitCode,
      command: check.command,
    };
  }
}

export function formatHistoryOutput(result) {
  return result.output || "(no matches)";
}

export function runHistoryEvidence(checks = HISTORY_CHECKS, options = {}) {
  const failures = [];

  for (const check of checks) {
    const result = runHistoryCommand(check, options);

    if (!result.ok) {
      failures.push(result);
      continue;
    }

    console.log(`$ ${check.command}`);
    console.log(formatHistoryOutput(result));
    console.log("");
  }

  return failures;
}

function printHistoryEvidence() {
  console.log("\nHistorical audit evidence (read-only):\n");

  const failures = runHistoryEvidence();

  if (failures.length > 0) {
    console.error("Historical audit command failed:\n");
    for (const failure of failures) {
      console.error(`$ ${failure.command}`);
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
