#!/usr/bin/env node
/**
 * Fail-closed policy for critical Storybook stories (#16 / #66).
 *
 * Validates that protected stories exist, retain the critical tag, required play
 * functions, and do not disable axe or weaken rules without a documented exception.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isValidIsoDate } from "./license-exceptions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..");

const DEFAULT_MANIFEST = path.join(
  REPO_ROOT,
  "packages/ui/.storybook/critical-stories.json"
);
const DEFAULT_EXCEPTIONS = path.join(
  REPO_ROOT,
  "packages/ui/.storybook/a11y-exceptions.json"
);
const DEFAULT_STORYBOOK_INDEX_RELATIVE = "packages/ui/storybook-static/index.json";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function extractStoryBlock(source, exportName) {
  const opener = new RegExp(`export const ${exportName}\\s*:\\s*Story\\s*=\\s*\\{`);
  const match = opener.exec(source);
  if (!match) {
    return null;
  }

  let depth = 1;
  let index = match.index + match[0].length;

  while (index < source.length && depth > 0) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
    }
    index += 1;
  }

  if (depth !== 0) {
    return null;
  }

  return source.slice(match.index + match[0].length, index - 1);
}

function hasCriticalTag(block) {
  return /tags\s*:\s*\[[^\]]*["']critical["']/.test(block);
}

function hasPlayFunction(block) {
  return /\bplay\s*:\s*async\b/.test(block);
}

function hasA11yDisable(block) {
  return /a11y\s*:\s*\{[^}]*disable\s*:\s*true/.test(block);
}

function extractNestedBlock(source, openIndex) {
  if (source[openIndex] !== "{") {
    return null;
  }

  let depth = 1;
  let index = openIndex + 1;

  while (index < source.length && depth > 0) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
    }
    index += 1;
  }

  if (depth !== 0) {
    return null;
  }

  return source.slice(openIndex + 1, index - 1);
}

function extractA11yConfigRules(block) {
  const a11yIndex = block.search(/a11y\s*:\s*\{/);
  if (a11yIndex === -1) {
    return [];
  }

  const a11yOpen = block.indexOf("{", a11yIndex);
  const a11yBody = extractNestedBlock(block, a11yOpen);
  if (!a11yBody) {
    return [];
  }

  const configIndex = a11yBody.search(/config\s*:\s*\{/);
  if (configIndex === -1) {
    return [];
  }

  const configOpen = a11yBody.indexOf("{", configIndex);
  const configBody = extractNestedBlock(a11yBody, configOpen);
  if (!configBody) {
    return [];
  }

  const rulesIndex = configBody.search(/rules\s*:\s*\{/);
  if (rulesIndex === -1) {
    return [];
  }

  const rulesOpen = configBody.indexOf("{", rulesIndex);
  const rulesBody = extractNestedBlock(configBody, rulesOpen);
  if (!rulesBody) {
    return [];
  }

  const disabled = [];
  const rulePattern = /["']([^"']+)["']\s*:\s*\{\s*enabled\s*:\s*false\s*\}/g;
  let ruleMatch;
  while ((ruleMatch = rulePattern.exec(rulesBody)) !== null) {
    disabled.push(ruleMatch[1]);
  }
  return disabled;
}

function parseIsoDate(value) {
  if (!ISO_DATE_PATTERN.test(value) || !isValidIsoDate(value)) {
    return null;
  }
  return new Date(`${value}T00:00:00.000Z`);
}

function isExpired(expiry) {
  const expiryDate = parseIsoDate(expiry);
  if (!expiryDate) {
    return true;
  }
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return expiryDate < today;
}

function validateExceptionRecord(record, index) {
  const failures = [];
  const required = ["storyId", "rule", "owner", "reason", "reviewedOn", "expiry"];
  for (const field of required) {
    if (!record[field] || typeof record[field] !== "string" || record[field].trim() === "") {
      failures.push(`exceptions[${index}]: missing or empty "${field}"`);
    }
  }

  if (record.reviewedOn && !parseIsoDate(record.reviewedOn)) {
    failures.push(`exceptions[${index}]: invalid reviewedOn "${record.reviewedOn}"`);
  }

  if (record.expiry && !parseIsoDate(record.expiry)) {
    failures.push(`exceptions[${index}]: invalid expiry "${record.expiry}"`);
  }

  if (record.expiry && isExpired(record.expiry)) {
    failures.push(
      `exceptions[${index}]: expired exception for ${record.storyId ?? "?"} rule ${record.rule ?? "?"} (expiry ${record.expiry})`
    );
  }

  return failures;
}

/**
 * Load the built Storybook index (produced by `pnpm --filter @atlas/ui build-storybook`) so
 * manifest story IDs can be validated against what Storybook actually generated, instead of
 * trusting `critical-stories.json` to stay in sync by hand. IDs are derived by Storybook from
 * title+export name, so a rename anywhere in that chain silently produces a new ID; comparing
 * against the built artifact (rather than reverse-engineering the ID algorithm) is the only way
 * to reliably catch that drift.
 *
 * Returns `missing: true` (not an error) when the file does not exist, so callers that cannot
 * guarantee Storybook was built first (e.g. `pnpm test` outside the UI Quality workflow) can
 * choose to treat that as non-fatal via `requireStorybookIndex`. Malformed/unparsable files are
 * always a failure, missing files are only a failure when required, and stale IDs are always a
 * failure when the index is present -- this is what keeps the check fail-closed in the one place
 * that matters (`storybook-critical-policy.mjs` run from CI, after the build step) without making
 * unrelated `pnpm test` runs that never build Storybook flaky.
 */
function loadStorybookIndex(storybookIndexPath) {
  if (!fs.existsSync(storybookIndexPath)) {
    return { entries: null, missing: true, error: null };
  }

  let data;
  try {
    data = readJson(storybookIndexPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      entries: null,
      missing: false,
      error: `Built Storybook index could not be parsed (${storybookIndexPath}): ${message}`,
    };
  }

  if (!data || typeof data.entries !== "object" || data.entries === null || Array.isArray(data.entries)) {
    return {
      entries: null,
      missing: false,
      error: `Built Storybook index is malformed: "entries" must be an object (${storybookIndexPath})`,
    };
  }

  return { entries: data.entries, missing: false, error: null };
}

function indexExceptions(exceptions) {
  const byStoryRule = new Map();
  for (const record of exceptions) {
    const key = `${record.storyId}::${record.rule}`;
    if (!byStoryRule.has(key)) {
      byStoryRule.set(key, []);
    }
    byStoryRule.get(key).push(record);
  }
  return byStoryRule;
}

export function loadCriticalManifest(manifestPath = DEFAULT_MANIFEST) {
  const manifest = readJson(manifestPath);
  if (!Array.isArray(manifest.stories)) {
    throw new Error(`Invalid manifest: stories must be an array (${manifestPath})`);
  }
  return manifest;
}

export function loadA11yExceptions(exceptionsPath = DEFAULT_EXCEPTIONS) {
  const data = readJson(exceptionsPath);
  if (!Array.isArray(data.exceptions)) {
    throw new Error(`Invalid exceptions file: exceptions must be an array (${exceptionsPath})`);
  }
  return data;
}

export function evaluateCriticalStoryPolicy({
  repoRoot = REPO_ROOT,
  manifestPath = DEFAULT_MANIFEST,
  exceptionsPath = DEFAULT_EXCEPTIONS,
  storybookIndexPath = path.join(repoRoot, DEFAULT_STORYBOOK_INDEX_RELATIVE),
  requireStorybookIndex = false,
} = {}) {
  const failures = [];
  const manifest = loadCriticalManifest(manifestPath);
  const exceptionsData = loadA11yExceptions(exceptionsPath);
  const storybookIndex = loadStorybookIndex(storybookIndexPath);
  const storybookIndexRelative = path.relative(repoRoot, storybookIndexPath) || storybookIndexPath;

  if (storybookIndex.error) {
    failures.push(storybookIndex.error);
  } else if (storybookIndex.missing && requireStorybookIndex) {
    failures.push(
      `Built Storybook index not found (${storybookIndexRelative}). Run "pnpm --filter @atlas/ui build-storybook" before validating the critical-story manifest.`
    );
  }

  for (let index = 0; index < exceptionsData.exceptions.length; index += 1) {
    failures.push(...validateExceptionRecord(exceptionsData.exceptions[index], index));
  }

  const exceptionIndex = indexExceptions(exceptionsData.exceptions);
  const manifestIds = new Set();

  for (const story of manifest.stories) {
    if (!story.id || !story.file || !story.exportName) {
      failures.push(`manifest entry missing id, file, or exportName: ${JSON.stringify(story)}`);
      continue;
    }

    manifestIds.add(story.id);
    const filePath = path.join(repoRoot, story.file);
    if (!fs.existsSync(filePath)) {
      failures.push(`${story.id}: story file missing (${story.file})`);
      continue;
    }

    const source = fs.readFileSync(filePath, "utf8");
    const block = extractStoryBlock(source, story.exportName);
    if (!block) {
      failures.push(`${story.id}: export ${story.exportName} not found in ${story.file}`);
      continue;
    }

    if (story.requiresCriticalTag && !hasCriticalTag(block)) {
      failures.push(`${story.id}: missing required critical tag`);
    }

    if (story.requiresPlay && !hasPlayFunction(block)) {
      failures.push(`${story.id}: missing required play interaction`);
    }

    if (hasA11yDisable(block)) {
      failures.push(`${story.id}: parameters.a11y.disable=true is not allowed on protected stories`);
    }

    if (storybookIndex.entries && !(story.id in storybookIndex.entries)) {
      failures.push(
        `${story.id}: story ID not found in built Storybook index (${storybookIndexRelative}) -- it is stale (the story title or export was renamed, generating a new ID, or the story was removed). Rebuild Storybook and update critical-stories.json with the current ID.`
      );
    }

    // Fail closed: if the effective (merged) Storybook index shows "no-tests" on a protected
    // story, it would cause the test runner to skip the story entirely regardless of the "critical"
    // tag. This catches both story-level and meta/globally-inherited "no-tests".
    if (
      storybookIndex.entries &&
      story.id in storybookIndex.entries &&
      Array.isArray(storybookIndex.entries[story.id].tags) &&
      storybookIndex.entries[story.id].tags.includes("no-tests")
    ) {
      failures.push(
        `${story.id}: story has "no-tests" tag in the built Storybook index (effective tags: ` +
          `${JSON.stringify(storybookIndex.entries[story.id].tags)}). A protected story must ` +
          `never be silently omitted from test execution. Remove "no-tests" from this story, ` +
          `its component meta, or any inherited tag source.`
      );
    }

    const disabledRules = extractA11yConfigRules(block);
    for (const rule of disabledRules) {
      const key = `${story.id}::${rule}`;
      const matches = exceptionIndex.get(key) ?? [];
      if (matches.length === 0) {
        failures.push(
          `${story.id}: axe rule "${rule}" disabled without documented exception in a11y-exceptions.json`
        );
      }
    }
  }

  for (const record of exceptionsData.exceptions) {
    if (record.storyId && !manifestIds.has(record.storyId)) {
      failures.push(
        `exceptions: storyId "${record.storyId}" is not listed in critical-stories.json`
      );
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    storyCount: manifest.stories.length,
  };
}

function parseArgs(argv) {
  const options = {
    manifestPath: DEFAULT_MANIFEST,
    exceptionsPath: DEFAULT_EXCEPTIONS,
    repoRoot: REPO_ROOT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--manifest" && argv[index + 1]) {
      options.manifestPath = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg === "--exceptions" && argv[index + 1]) {
      options.exceptionsPath = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg === "--repo-root" && argv[index + 1]) {
      options.repoRoot = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg === "--storybook-index" && argv[index + 1]) {
      options.storybookIndexPath = path.resolve(argv[index + 1]);
      index += 1;
    }
  }

  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  // The CLI is the authoritative enforcement entrypoint (run from CI after build-storybook), so it
  // always requires the built Storybook index to exist -- unlike the bare `evaluateCriticalStoryPolicy()`
  // default used by unit tests that may run without a Storybook build available (see
  // storybook-critical-policy.test.mjs).
  const result = evaluateCriticalStoryPolicy({ ...options, requireStorybookIndex: true });

  if (result.ok) {
    console.log(
      `Storybook critical policy OK (${result.storyCount} protected stories, ${readJson(options.exceptionsPath).exceptions.length} a11y exceptions)`
    );
    return;
  }

  console.error("Storybook critical policy FAILED:");
  for (const failure of result.failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
