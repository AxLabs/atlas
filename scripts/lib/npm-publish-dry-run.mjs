import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

import { PUBLIC_CLI_BIN_NAME, PUBLIC_CLI_PACKAGE_NAME } from "../atlas-workspaces.mjs";

export const NPM_PUBLISH_DRY_RUN_ARGS = ["publish", "--dry-run", "--access", "public"];
export const NPM_PACK_DRY_RUN_ARGS = ["pack", "--dry-run", "--json", "--ignore-scripts"];

const RUNTIME_DEPENDENCY_SECTIONS = ["dependencies", "optionalDependencies", "peerDependencies"];

export const REQUIRED_PACKED_FILES = [
  "package.json",
  "dist/cli.js",
  "dist/index.js",
  "dist/dependency-validation.js",
  "dist/bootstrap-assets.js",
  "dist/release-assets.js",
  "LICENSE",
  "README.md",
  "THIRD_PARTY_NOTICES.md",
  "assets/bootstrap/manifest.json",
  "assets/releases/catalog.json",
];

function isCliPackageNoisePath(entry) {
  return !entry.startsWith("assets/") && !entry.startsWith("dist/");
}

function isSecretEnvPath(entry) {
  const base = entry.split("/").pop() ?? "";
  if (base === ".env") {
    return true;
  }
  return base.startsWith(".env.") && !base.endsWith(".example");
}

const PACKAGED_STORYBOOK_VISUAL_ASSET_PREFIXES = [
  "assets/capabilities/files/storybook/",
  "assets/capabilities/files/visual/",
];

/**
 * Opt-in Storybook and visual capability files are packaged under
 * `assets/capabilities/files/{storybook,visual}/`. Those destinations are
 * intentional; Storybook paths anywhere else remain forbidden.
 * @param {string} entry
 */
export function isPackagedStorybookOrVisualCapabilityAsset(entry) {
  return PACKAGED_STORYBOOK_VISUAL_ASSET_PREFIXES.some((prefix) => entry.startsWith(prefix));
}

/**
 * @param {string} entry
 */
export function isForbiddenStorybookPackedPath(entry) {
  if (isPackagedStorybookOrVisualCapabilityAsset(entry)) {
    return false;
  }
  return entry.includes(".storybook/") || /(^|\/)storybook(\.|$)/i.test(entry);
}

export const FORBIDDEN_PACKED_PATH_PATTERNS = [
  {
    id: "src",
    test: (entry) => isCliPackageNoisePath(entry) && (entry === "src" || entry.startsWith("src/")),
  },
  {
    id: "tests",
    test: (entry) =>
      isCliPackageNoisePath(entry) &&
      (entry.includes("/__tests__/") ||
        entry.startsWith("__tests__/") ||
        entry.includes("/fixtures/") ||
        entry.startsWith("fixtures/")),
  },
  {
    id: "scripts",
    test: (entry) =>
      isCliPackageNoisePath(entry) && (entry === "scripts" || entry.startsWith("scripts/")),
  },
  { id: "github", test: (entry) => entry === ".github" || entry.startsWith(".github/") },
  { id: "git", test: (entry) => entry === ".git" || entry.startsWith(".git/") },
  { id: "env", test: (entry) => isSecretEnvPath(entry) },
  {
    id: "node-modules",
    test: (entry) => entry === "node_modules" || entry.includes("/node_modules/"),
  },
  { id: "coverage", test: (entry) => entry === "coverage" || entry.startsWith("coverage/") },
  {
    id: "cache",
    test: (entry) =>
      entry === ".turbo" ||
      entry.startsWith(".turbo/") ||
      entry.includes("/.turbo/") ||
      entry === ".cache" ||
      entry.startsWith(".cache/") ||
      entry.includes("/.cache/"),
  },
  {
    id: "changeset",
    test: (entry) => entry === ".changeset" || entry.startsWith(".changeset/"),
  },
  {
    id: "storybook",
    test: isForbiddenStorybookPackedPath,
  },
];

/**
 * @param {string} entry
 * @returns {string}
 */
export function normalizePackedEntry(entry) {
  return entry.replace(/^package\//, "").replace(/\/$/, "");
}

const AUTH_FAILURE_PATTERN = /ENEEDAUTH|npm ERR! code ENEEDAUTH/i;
const AUTH_WARNING_PATTERN = /This command requires you to be logged in[^\n]*\(dry-run\)/i;
const ALREADY_PUBLISHED_PATTERN = /cannot publish over the previously published versions/i;

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {string} output
 * @returns {unknown}
 */
export function extractJsonPayload(output) {
  const text = output.trim();
  if (!text) {
    throw new Error("npm produced empty stdout");
  }

  const objectStart = text.indexOf("{");
  const arrayStart = text.indexOf("[");
  const candidates = [objectStart, arrayStart].filter((index) => index >= 0);
  if (candidates.length === 0) {
    throw new Error(`npm did not emit JSON:\n${text}`);
  }

  return JSON.parse(text.slice(Math.min(...candidates)));
}

/**
 * @param {unknown} payload
 * @returns {{ name?: string; version?: string; filename?: string; files: string[] }}
 */
export function normalizeNpmPackPayload(payload) {
  const record = Array.isArray(payload) ? payload[0] : payload;
  if (!isRecord(record)) {
    throw new Error("npm pack --dry-run --json did not return a package object");
  }

  const files = Array.isArray(record.files)
    ? record.files.map((entry) =>
        isRecord(entry) && typeof entry.path === "string" ? entry.path : String(entry)
      )
    : [];

  return {
    name: typeof record.name === "string" ? record.name : undefined,
    version: typeof record.version === "string" ? record.version : undefined,
    filename: typeof record.filename === "string" ? record.filename : undefined,
    files,
  };
}

/**
 * @param {Record<string, unknown>} manifest
 * @returns {string[]}
 */
export function collectRuntimeWorkspaceProtocolLeaks(manifest) {
  /** @type {string[]} */
  const leaks = [];
  for (const section of RUNTIME_DEPENDENCY_SECTIONS) {
    const deps = manifest[section];
    if (!isRecord(deps)) {
      continue;
    }
    for (const [name, range] of Object.entries(deps)) {
      if (typeof range === "string" && range.includes("workspace:")) {
        leaks.push(`${section} ${name}: ${range}`);
      }
    }
  }
  return leaks;
}

/**
 * @param {Record<string, unknown>} manifest
 * @returns {string[]}
 */
export function assertPublicCliManifest(manifest) {
  /** @type {string[]} */
  const issues = [];

  if (manifest.name !== PUBLIC_CLI_PACKAGE_NAME) {
    issues.push(`package name is ${String(manifest.name)}, expected ${PUBLIC_CLI_PACKAGE_NAME}`);
  }
  if (manifest.private === true) {
    issues.push("package remains private");
  }

  const bin = isRecord(manifest.bin) ? manifest.bin : {};
  if (bin[PUBLIC_CLI_BIN_NAME] !== "./dist/cli.js") {
    issues.push(
      `bin.${PUBLIC_CLI_BIN_NAME} is ${String(bin[PUBLIC_CLI_BIN_NAME])}, expected ./dist/cli.js`
    );
  }

  const publishConfig = isRecord(manifest.publishConfig) ? manifest.publishConfig : {};
  if (publishConfig.access !== "public") {
    issues.push(`publishConfig.access is ${String(publishConfig.access)}, expected public`);
  }

  const repository = isRecord(manifest.repository) ? manifest.repository : {};
  const repositoryUrl = typeof repository.url === "string" ? repository.url : "";
  if (!repositoryUrl.includes("github.com/blitzcraftlabs/atlas")) {
    issues.push("repository.url must point to github.com/blitzcraftlabs/atlas");
  }
  if (repository.directory !== "packages/cli") {
    issues.push(`repository.directory is ${String(repository.directory)}, expected packages/cli`);
  }

  if (manifest.license !== "Apache-2.0") {
    issues.push(`license is ${String(manifest.license)}, expected Apache-2.0`);
  }

  const engines = isRecord(manifest.engines) ? manifest.engines : {};
  if (typeof engines.node !== "string" || !engines.node.includes("22")) {
    issues.push(`engines.node is ${String(engines.node)}, expected a Node >=22 requirement`);
  }

  issues.push(
    ...collectRuntimeWorkspaceProtocolLeaks(manifest).map(
      (leak) => `runtime workspace dependency ${leak}`
    )
  );
  return issues;
}

/**
 * @param {string[]} files
 * @returns {string[]}
 */
export function collectPackedFileIssues(files) {
  /** @type {string[]} */
  const issues = [];
  const normalized = files
    .map((file) => normalizePackedEntry(file))
    .filter((file) => file.length > 0);
  const packed = new Set(normalized);

  for (const required of REQUIRED_PACKED_FILES) {
    if (!packed.has(required)) {
      issues.push(`packed files are missing ${required}`);
    }
  }

  for (const file of normalized) {
    const forbidden = FORBIDDEN_PACKED_PATH_PATTERNS.find((pattern) => pattern.test(file));
    if (forbidden) {
      issues.push(`packed files include forbidden ${forbidden.id} path: ${file}`);
    }
  }

  return issues;
}

/**
 * @param {string} output
 * @param {number | null} [status]
 */
export function detectNpmAuthRequirement(output, status = null) {
  if (AUTH_FAILURE_PATTERN.test(output)) {
    return true;
  }
  if (status === 0 && AUTH_WARNING_PATTERN.test(output)) {
    return false;
  }
  return /need(?:s)? to (?:be )?logged in|you must be logged in/i.test(output) && status !== 0;
}

/**
 * npm 11+ dry-run may exit non-zero when the version already exists on the
 * registry. Pack contents and public-access checks still succeeded.
 * @param {string} output
 * @param {number | null} [status]
 */
export function detectAlreadyPublishedDryRun(output, status = null) {
  return status !== 0 && ALREADY_PUBLISHED_PATTERN.test(output);
}

/**
 * @param {string} directory
 */
export function removeGeneratedTarballs(directory) {
  for (const name of readdirSync(directory)) {
    if (name.endsWith(".tgz")) {
      rmSync(path.join(directory, name), { force: true });
    }
  }
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd: string; env?: NodeJS.ProcessEnv; timeout?: number }} options
 */
function runNpm(command, args, options) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: "utf8",
    timeout: options.timeout ?? 120_000,
    maxBuffer: 10 * 1024 * 1024,
  });

  const stdout =
    typeof result.stdout === "string" ? result.stdout : (result.stdout?.toString("utf8") ?? "");
  const stderr =
    typeof result.stderr === "string" ? result.stderr : (result.stderr?.toString("utf8") ?? "");
  const timedOut = Boolean(
    result.error && "code" in result.error && result.error.code === "ETIMEDOUT"
  );

  return {
    status: timedOut ? null : (result.status ?? (result.error ? 1 : 0)),
    stdout,
    stderr,
    timedOut,
    error: result.error instanceof Error ? result.error.message : "",
  };
}

/**
 * @param {{
 *   packageRoot: string;
 *   env?: NodeJS.ProcessEnv;
 *   npmCommand?: string;
 * }} options
 */
export function verifyNpmPublishDryRun(options) {
  const packageRoot = options.packageRoot;
  const npmCommand = options.npmCommand ?? "npm";
  const env = {
    ...process.env,
    ...options.env,
    NO_COLOR: "1",
    FORCE_COLOR: "0",
    npm_config_funding: "false",
    npm_config_audit: "false",
    npm_config_update_notifier: "false",
  };

  const manifest = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  const manifestIssues = assertPublicCliManifest(manifest);
  if (manifestIssues.length > 0) {
    throw new Error(`Public CLI package is not npm-publishable:\n${manifestIssues.join("\n")}`);
  }

  try {
    const pack = runNpm(npmCommand, NPM_PACK_DRY_RUN_ARGS, { cwd: packageRoot, env });
    if (pack.status !== 0 || pack.timedOut) {
      throw new Error(
        `npm pack --dry-run failed (${pack.timedOut ? "timed out" : pack.status})\nstdout:\n${pack.stdout}\nstderr:\n${pack.stderr}`
      );
    }

    const packPayload = normalizeNpmPackPayload(extractJsonPayload(pack.stdout));
    const packedFileIssues = collectPackedFileIssues(packPayload.files);
    if (packPayload.name !== PUBLIC_CLI_PACKAGE_NAME) {
      packedFileIssues.push(
        `npm pack name is ${String(packPayload.name)}, expected ${PUBLIC_CLI_PACKAGE_NAME}`
      );
    }
    if (packedFileIssues.length > 0) {
      throw new Error(`npm pack --dry-run contents are invalid:\n${packedFileIssues.join("\n")}`);
    }

    const publish = runNpm(npmCommand, [...NPM_PUBLISH_DRY_RUN_ARGS, "--ignore-scripts"], {
      cwd: packageRoot,
      env,
    });
    const combined = `${publish.stdout}\n${publish.stderr}\n${publish.error}`;
    if (detectNpmAuthRequirement(combined, publish.status)) {
      throw new Error(
        "npm publish --dry-run unexpectedly required authentication. Stopped without introducing credentials."
      );
    }
    const alreadyPublished = detectAlreadyPublishedDryRun(combined, publish.status);
    if ((publish.status !== 0 || publish.timedOut) && !alreadyPublished) {
      throw new Error(
        `npm publish --dry-run --access public failed (${publish.timedOut ? "timed out" : publish.status})\nstdout:\n${publish.stdout}\nstderr:\n${publish.stderr}`
      );
    }

    if (!combined.includes(PUBLIC_CLI_PACKAGE_NAME)) {
      throw new Error(`npm publish --dry-run output did not mention ${PUBLIC_CLI_PACKAGE_NAME}`);
    }
    if (/This package has been marked as private/i.test(combined)) {
      throw new Error("npm publish --dry-run treated the package as private");
    }

    return {
      manifest,
      pack,
      publish,
      packedFiles: packPayload.files,
      filename: packPayload.filename,
    };
  } finally {
    removeGeneratedTarballs(packageRoot);
  }
}
