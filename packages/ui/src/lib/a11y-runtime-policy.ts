/**
 * Runtime accessibility policy for the critical Storybook test-runner.
 *
 * `scripts/storybook-critical-policy.mjs` inspects story source text as an early structural
 * check, but source text cannot see accessibility parameters inherited from Storybook's global
 * preview, component meta, or merged configuration. This module is the authoritative, fail-closed
 * runtime gate: `.storybook/test-runner.ts` calls `evaluateA11yRuntimePolicy` with the *effective
 * merged* `parameters.a11y` Storybook computes for each story (via `getStoryContext`), so a
 * disable or a rule override inherited from any level is caught the same way a story-level one
 * would be.
 *
 * Date validation intentionally mirrors `scripts/license-exceptions.mjs` (`isValidIsoDate`). Keep
 * the two in sync if the exception date format ever changes.
 */

import { readFileSync } from "node:fs";

export interface A11yException {
  storyId: string;
  rule: string;
  owner: string;
  reason: string;
  reviewedOn: string;
  expiry: string;
}

export interface InvalidA11yException {
  index: number;
  failures: string[];
}

export interface A11yExceptionValidation {
  valid: A11yException[];
  invalid: InvalidA11yException[];
}

/** Map-form rule value: only `{ enabled: boolean }` is supported on protected stories. */
export interface A11yRuleMapEntry {
  enabled: boolean;
}

export type A11yRuleMap = Record<string, A11yRuleMapEntry>;

/** Array-form rule entry: only `{ id: string; enabled: boolean }` is supported. */
export interface A11yRuleArrayEntry {
  id: string;
  enabled: boolean;
}

/** Only `rules` may appear in Storybook `parameters.a11y.config` on protected stories. */
export const SUPPORTED_A11Y_CONFIG_KEYS = ["rules"] as const;

export type SupportedA11yConfigKey = (typeof SUPPORTED_A11Y_CONFIG_KEYS)[number];

export interface EffectiveA11yParameters {
  disable?: boolean;
  config?: Partial<Record<SupportedA11yConfigKey, unknown>> & {
    rules?: A11yRuleMap | A11yRuleArrayEntry[];
    /** Rejected at policy time — narrows axe to an explicit rule subset. */
    disableOtherRules?: boolean;
    /** Rejected at policy time — can disable or replace built-in axe checks. */
    checks?: Record<string, unknown> | unknown[];
  };
  /**
   * Axe run-time options (passed to axe.run()). Any value here can narrow the axe scan scope
   * (e.g. `runOnly`, `rules` as run options) on a protected story, so the policy forbids it
   * unless a valid exception is registered. Currently no options are whitelisted — the only
   * supported coverage-narrowing mechanisms are `config.rules` disable exceptions in
   * a11y-exceptions.json.
   */
  options?: Record<string, unknown>;
}

export interface A11yRuntimeCheckInput {
  storyId: string;
  parameters: { a11y?: EffectiveA11yParameters } | null | undefined;
  validExceptions: A11yException[];
  exceptionFileFailures: string[];
}

export interface A11yRuntimeCheckResult {
  ok: boolean;
  failures: string[];
  disabledRules: string[];
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REQUIRED_EXCEPTION_FIELDS = [
  "storyId",
  "rule",
  "owner",
  "reason",
  "reviewedOn",
  "expiry",
] as const;

export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function isExceptionExpired(expiry: unknown): boolean {
  if (!isValidIsoDate(expiry)) {
    return true;
  }
  const expiryDate = new Date(`${expiry}T00:00:00.000Z`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return expiryDate < today;
}

/** Structural validation for a single exception record. Mirrors storybook-critical-policy.mjs. */
export function validateExceptionRecord(record: unknown, index: number): string[] {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return [`exceptions[${index}]: must be an object`];
  }

  const candidate = record as Record<string, unknown>;
  const failures: string[] = [];

  for (const field of REQUIRED_EXCEPTION_FIELDS) {
    const value = candidate[field];
    if (typeof value !== "string" || value.trim() === "") {
      failures.push(`exceptions[${index}]: missing or empty "${field}"`);
    }
  }

  if (typeof candidate.reviewedOn === "string" && !isValidIsoDate(candidate.reviewedOn)) {
    failures.push(`exceptions[${index}]: invalid reviewedOn "${candidate.reviewedOn}"`);
  }

  if (typeof candidate.expiry === "string") {
    if (!isValidIsoDate(candidate.expiry)) {
      failures.push(`exceptions[${index}]: invalid expiry "${candidate.expiry}"`);
    } else if (isExceptionExpired(candidate.expiry)) {
      failures.push(
        `exceptions[${index}]: expired exception for ${String(candidate.storyId ?? "?")} rule ${String(candidate.rule ?? "?")} (expiry ${candidate.expiry})`
      );
    }
  }

  return failures;
}

/**
 * Validate the whole a11y-exceptions.json payload. Malformed or expired records are excluded from
 * `valid` (so they can never authorize weakening a check) and are always reported in `invalid`.
 */
export function validateA11yExceptions(data: unknown): A11yExceptionValidation {
  const container = data as { exceptions?: unknown } | null | undefined;

  if (!container || !Array.isArray(container.exceptions)) {
    return {
      valid: [],
      invalid: [{ index: -1, failures: ['a11y-exceptions.json: "exceptions" must be an array'] }],
    };
  }

  const valid: A11yException[] = [];
  const invalid: InvalidA11yException[] = [];

  container.exceptions.forEach((record, index) => {
    const failures = validateExceptionRecord(record, index);
    if (failures.length > 0) {
      invalid.push({ index, failures });
    } else {
      valid.push(record as A11yException);
    }
  });

  return { valid, invalid };
}

export function loadA11yExceptionsFile(filePath: string): A11yExceptionValidation {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      valid: [],
      invalid: [
        {
          index: -1,
          failures: [`a11y-exceptions.json could not be read or parsed (${filePath}): ${message}`],
        },
      ],
    };
  }
  return validateA11yExceptions(data);
}

/** Reads disabled rule ids from validated `{ id, enabled }` array or `{ ruleId: { enabled } }` map shapes. */
export function extractDisabledRuleIds(
  rules: A11yRuleMap | A11yRuleArrayEntry[] | undefined
): string[] {
  if (!rules) {
    return [];
  }

  if (Array.isArray(rules)) {
    return rules.filter((rule) => rule.enabled === false).map((rule) => rule.id);
  }

  return Object.entries(rules)
    .filter(([, value]) => value.enabled === false)
    .map(([ruleId]) => ruleId);
}

/**
 * Fail-closed allowlist for Storybook `parameters.a11y.config.rules`.
 * Only `{ id, enabled }` (array form) or `{ [ruleId]: { enabled } }` (map form) are supported.
 * Any other axe rule property (selector, matches, reviewOnFail, impact, etc.) can weaken coverage
 * without setting enabled=false and is rejected.
 */
export function validateA11yRules(storyId: string, rules: unknown): string[] {
  if (rules === undefined) {
    return [];
  }

  const failures: string[] = [];

  if (Array.isArray(rules)) {
    rules.forEach((entry, index) => {
      if (!isPlainObject(entry)) {
        failures.push(
          `${storyId}: effective parameters.a11y.config.rules[${index}] must be a plain object with id and enabled`
        );
        return;
      }

      const extraKeys = Object.keys(entry).filter((key) => key !== "id" && key !== "enabled");
      if (extraKeys.length > 0) {
        failures.push(
          `${storyId}: effective parameters.a11y.config.rules[${index}] contains unsupported properties (${extraKeys.join(", ")}) — only id and enabled are allowed on protected stories`
        );
      }

      if (typeof entry.id !== "string" || entry.id.trim() === "") {
        failures.push(
          `${storyId}: effective parameters.a11y.config.rules[${index}] requires a non-empty string id`
        );
      }

      if (typeof entry.enabled !== "boolean") {
        failures.push(
          `${storyId}: effective parameters.a11y.config.rules[${index}] requires enabled to be a boolean`
        );
      }
    });

    return failures;
  }

  if (!isPlainObject(rules)) {
    return [
      `${storyId}: effective parameters.a11y.config.rules must be an array or plain object map when present`,
    ];
  }

  for (const [ruleId, value] of Object.entries(rules)) {
    if (ruleId.trim() === "") {
      failures.push(
        `${storyId}: effective parameters.a11y.config.rules map keys must be non-empty rule id strings`
      );
      continue;
    }

    if (typeof value === "boolean") {
      failures.push(
        `${storyId}: effective parameters.a11y.config.rules["${ruleId}"] must be { enabled: boolean } — bare boolean values are not allowed on protected stories`
      );
      continue;
    }

    if (!isPlainObject(value)) {
      failures.push(
        `${storyId}: effective parameters.a11y.config.rules["${ruleId}"] must be a plain object with only enabled`
      );
      continue;
    }

    const extraKeys = Object.keys(value).filter((key) => key !== "enabled");
    if (extraKeys.length > 0) {
      failures.push(
        `${storyId}: effective parameters.a11y.config.rules["${ruleId}"] contains unsupported properties (${extraKeys.join(", ")}) — only enabled is allowed on protected stories`
      );
    }

    if (typeof value.enabled !== "boolean") {
      failures.push(
        `${storyId}: effective parameters.a11y.config.rules["${ruleId}"] requires enabled to be a boolean`
      );
    }
  }

  return failures;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Fail-closed allowlist for Storybook `parameters.a11y.config` (axe.configure() input).
 * Only `rules` is supported on protected stories; every other configure-time key can weaken
 * coverage (disableOtherRules, checks, locale, etc.) and is rejected.
 */
export function validateA11yConfig(
  storyId: string,
  config: EffectiveA11yParameters["config"] | undefined
): string[] {
  if (config === undefined) {
    return [];
  }

  if (!isPlainObject(config)) {
    return [`${storyId}: effective parameters.a11y.config must be a plain object when present`];
  }

  const failures: string[] = [];

  if (config.disableOtherRules === true) {
    failures.push(
      `${storyId}: effective parameters.a11y.config.disableOtherRules=true is not allowed on protected stories — ` +
        `it narrows axe to an explicit rule subset instead of the default full scan`
    );
  }

  if (config.checks !== undefined) {
    failures.push(
      `${storyId}: effective parameters.a11y.config.checks is not allowed on protected stories — ` +
        `configure-time checks can disable or replace built-in axe checks`
    );
  }

  const explicitlyHandledKeys = new Set(["disableOtherRules", "checks"]);

  for (const key of Object.keys(config)) {
    if (explicitlyHandledKeys.has(key)) {
      continue;
    }
    if (!(SUPPORTED_A11Y_CONFIG_KEYS as readonly string[]).includes(key)) {
      failures.push(
        `${storyId}: effective parameters.a11y.config.${key} is not allowed on protected stories — ` +
          `only config.rules is supported; unsupported configure-time keys can silently weaken axe coverage`
      );
    }
  }

  if (config.rules !== undefined) {
    failures.push(...validateA11yRules(storyId, config.rules));
  }

  return failures;
}

/**
 * Authoritative fail-closed decision for one story's *effective merged* accessibility parameters.
 * No global, meta, or story-level configuration can weaken checks unless a valid, unexpired,
 * exact story+rule exception exists in the registry.
 */
export function evaluateA11yRuntimePolicy(input: A11yRuntimeCheckInput): A11yRuntimeCheckResult {
  const failures: string[] = [...input.exceptionFileFailures];
  const a11y = input.parameters?.a11y ?? {};

  if (a11y.disable === true) {
    failures.push(
      `${input.storyId}: effective parameters.a11y.disable=true is not allowed on protected stories (global, meta, and story parameters are merged before this check runs)`
    );
  }

  // Forbid a11y.options on protected stories. Storybook a11y run options (e.g. runOnly, per-run
  // rules config) can narrow the axe scan scope in ways that are just as dangerous as disabling
  // individual rules. No whitelisted options exist — any a11y.options on a critical story is an
  // unsupported narrowing attempt and must fail the policy.
  if (a11y.options && typeof a11y.options === "object" && Object.keys(a11y.options).length > 0) {
    failures.push(
      `${input.storyId}: effective parameters.a11y.options is not allowed on protected stories — ` +
        `axe run options can narrow scan scope (e.g. runOnly, rules). Remove a11y.options or ` +
        `move this story out of the protected matrix.`
    );
  }

  failures.push(...validateA11yConfig(input.storyId, a11y.config));

  const disabledRules = extractDisabledRuleIds(a11y.config?.rules);
  for (const rule of disabledRules) {
    const hasValidException = input.validExceptions.some(
      (exception) => exception.storyId === input.storyId && exception.rule === rule
    );
    if (!hasValidException) {
      failures.push(
        `${input.storyId}: axe rule "${rule}" is disabled in effective parameters without a valid, unexpired exception in a11y-exceptions.json`
      );
    }
  }

  return { ok: failures.length === 0, failures, disabledRules };
}
