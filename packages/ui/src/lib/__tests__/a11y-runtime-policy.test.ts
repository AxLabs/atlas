import { composeStory } from "@storybook/react";

import {
  evaluateA11yRuntimePolicy,
  extractDisabledRuleIds,
  isExceptionExpired,
  isValidIsoDate,
  validateA11yConfig,
  validateA11yExceptions,
  validateA11yRules,
  validateExceptionRecord,
  type EffectiveA11yParameters,
} from "../a11y-runtime-policy";

/**
 * These tests exercise the *actual* Storybook portable-stories composition (`composeStory`) so
 * inheritance from global preview / component meta / story parameters is proven using Storybook's
 * own merge algorithm, not a hand-rolled reimplementation of it. This is the same merge pipeline
 * the real `.storybook/test-runner.ts` reaches at runtime via `getStoryContext`.
 */
function composedA11yParameters(
  story: Record<string, unknown>,
  meta: Record<string, unknown>,
  projectAnnotations: Record<string, unknown> | undefined,
  exportsName: string
): { id: string; parameters: { a11y?: EffectiveA11yParameters } } {
  const composed = composeStory(
    story as never,
    meta as never,
    projectAnnotations as never,
    exportsName
  );
  return { id: composed.id, parameters: composed.parameters as { a11y?: EffectiveA11yParameters } };
}

function evaluateWithRawExceptions(
  storyId: string,
  parameters: { a11y?: EffectiveA11yParameters },
  rawExceptions: unknown
) {
  const { valid, invalid } = validateA11yExceptions(rawExceptions);
  return evaluateA11yRuntimePolicy({
    storyId,
    parameters,
    validExceptions: valid,
    exceptionFileFailures: invalid.flatMap((entry) => entry.failures),
  });
}

const META_NO_A11Y = { title: "Fixtures/RuntimePolicy", tags: ["autodocs"] };
const CRITICAL_STORY_NO_A11Y = { tags: ["critical"], render: () => null };

describe("isValidIsoDate", () => {
  it("accepts real calendar dates", () => {
    expect(isValidIsoDate("2026-01-01")).toBe(true);
  });

  it("rejects malformed or impossible dates", () => {
    expect(isValidIsoDate("2026-13-40")).toBe(false);
    expect(isValidIsoDate("01-01-2026")).toBe(false);
    expect(isValidIsoDate(undefined)).toBe(false);
    expect(isValidIsoDate(20260101)).toBe(false);
  });
});

describe("isExceptionExpired", () => {
  it("treats far-future dates as not expired", () => {
    expect(isExceptionExpired("2099-01-01")).toBe(false);
  });

  it("treats past dates and invalid input as expired", () => {
    expect(isExceptionExpired("2024-01-01")).toBe(true);
    expect(isExceptionExpired("not-a-date")).toBe(true);
  });
});

describe("validateExceptionRecord", () => {
  const valid = {
    storyId: "ui-select--keyboard-interaction",
    rule: "color-contrast",
    owner: "@atlas/ui-owners",
    reason: "Documented false positive",
    reviewedOn: "2026-01-01",
    expiry: "2099-01-01",
  };

  it("accepts a well-formed, unexpired record", () => {
    expect(validateExceptionRecord(valid, 0)).toEqual([]);
  });

  it("fails on missing required fields", () => {
    const withoutOwner = { ...valid, owner: "" };
    const failures = validateExceptionRecord(withoutOwner, 0);
    expect(failures.join("\n")).toMatch(/missing or empty "owner"/);
  });

  it("fails on malformed dates", () => {
    const failures = validateExceptionRecord({ ...valid, expiry: "01/01/2099" }, 0);
    expect(failures.join("\n")).toMatch(/invalid expiry/);
  });

  it("fails on expired exceptions", () => {
    const failures = validateExceptionRecord({ ...valid, expiry: "2024-06-01" }, 0);
    expect(failures.join("\n")).toMatch(/expired exception/);
  });

  it("fails on non-object records", () => {
    expect(validateExceptionRecord(null, 0).length).toBeGreaterThan(0);
    expect(validateExceptionRecord("nope", 0).length).toBeGreaterThan(0);
  });
});

describe("validateA11yExceptions", () => {
  it("fails closed when exceptions is not an array", () => {
    const { valid, invalid } = validateA11yExceptions({ exceptions: "nope" });
    expect(valid).toEqual([]);
    expect(invalid[0]?.failures.join()).toMatch(/must be an array/);
  });

  it("separates valid records from malformed/expired ones", () => {
    const { valid, invalid } = validateA11yExceptions({
      exceptions: [
        {
          storyId: "ui-select--keyboard-interaction",
          rule: "color-contrast",
          owner: "@atlas/ui-owners",
          reason: "ok",
          reviewedOn: "2026-01-01",
          expiry: "2099-01-01",
        },
        {
          storyId: "ui-select--keyboard-interaction",
          rule: "stale-rule",
          owner: "@atlas/ui-owners",
          reason: "stale",
          reviewedOn: "2024-01-01",
          expiry: "2024-06-01",
        },
      ],
    });
    expect(valid).toHaveLength(1);
    expect(valid[0]?.rule).toBe("color-contrast");
    expect(invalid).toHaveLength(1);
    expect(invalid[0]?.failures.join()).toMatch(/expired exception/);
  });
});

describe("extractDisabledRuleIds", () => {
  it("reads the object-map shape used across critical-stories fixtures", () => {
    expect(
      extractDisabledRuleIds({
        "color-contrast": { enabled: false },
        "image-alt": { enabled: true },
      })
    ).toEqual(["color-contrast"]);
  });

  it("also reads the array shape axe.configure() accepts", () => {
    expect(extractDisabledRuleIds([{ id: "image-alt", enabled: false }])).toEqual(["image-alt"]);
  });

  it("returns an empty list when nothing is disabled", () => {
    expect(extractDisabledRuleIds(undefined)).toEqual([]);
    expect(extractDisabledRuleIds({ "color-contrast": { enabled: true } })).toEqual([]);
  });
});

describe("evaluateA11yRuntimePolicy (direct parameter objects)", () => {
  it("fails when effective parameters.a11y.disable is true", () => {
    const result = evaluateA11yRuntimePolicy({
      storyId: "ui-fixture--story",
      parameters: { a11y: { disable: true } },
      validExceptions: [],
      exceptionFileFailures: [],
    });
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toMatch(/a11y\.disable=true is not allowed/);
  });

  it("fails closed when the exceptions file itself is malformed, even for an unrelated story", () => {
    const result = evaluateA11yRuntimePolicy({
      storyId: "ui-fixture--story",
      parameters: {},
      validExceptions: [],
      exceptionFileFailures: ['a11y-exceptions.json: "exceptions" must be an array'],
    });
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toMatch(/must be an array/);
  });

  it("passes clean stories with no a11y overrides", () => {
    const result = evaluateA11yRuntimePolicy({
      storyId: "ui-fixture--story",
      parameters: {},
      validExceptions: [],
      exceptionFileFailures: [],
    });
    expect(result).toEqual({ ok: true, failures: [], disabledRules: [] });
  });
});

describe("runtime policy against Storybook's real composed parameters", () => {
  it("1. fails when the story itself disables a11y", () => {
    const { id, parameters } = composedA11yParameters(
      { ...CRITICAL_STORY_NO_A11Y, parameters: { a11y: { disable: true } } },
      META_NO_A11Y,
      undefined,
      "StoryLevelDisable"
    );
    const result = evaluateWithRawExceptions(id, parameters, { version: 1, exceptions: [] });
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toMatch(/a11y\.disable=true is not allowed/);
  });

  it("2. fails when only the component meta disables a11y (story sets nothing)", () => {
    const metaWithDisable = { ...META_NO_A11Y, parameters: { a11y: { disable: true } } };
    const { id, parameters } = composedA11yParameters(
      CRITICAL_STORY_NO_A11Y,
      metaWithDisable,
      undefined,
      "InheritsMetaDisable"
    );
    // Prove the inheritance actually happened before asserting on the policy decision.
    expect(parameters.a11y?.disable).toBe(true);
    const result = evaluateWithRawExceptions(id, parameters, { version: 1, exceptions: [] });
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toMatch(/a11y\.disable=true is not allowed/);
  });

  it("3. fails when a disabled axe rule is only inherited from the global preview, without an exception", () => {
    const globalPreview = {
      parameters: { a11y: { config: { rules: { "color-contrast": { enabled: false } } } } },
    };
    const { id, parameters } = composedA11yParameters(
      CRITICAL_STORY_NO_A11Y,
      META_NO_A11Y,
      globalPreview,
      "InheritsGlobalRuleDisable"
    );
    expect(extractDisabledRuleIds(parameters.a11y?.config?.rules)).toEqual(["color-contrast"]);
    const result = evaluateWithRawExceptions(id, parameters, { version: 1, exceptions: [] });
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toMatch(
      /"color-contrast".*without a valid, unexpired exception/
    );
  });

  it("4. passes with an approved, unexpired, exact story+rule exception", () => {
    const storyWithRuleDisable = {
      ...CRITICAL_STORY_NO_A11Y,
      parameters: { a11y: { config: { rules: { "color-contrast": { enabled: false } } } } },
    };
    const { id, parameters } = composedA11yParameters(
      storyWithRuleDisable,
      META_NO_A11Y,
      undefined,
      "RuleDisableWithApprovedException"
    );
    const result = evaluateWithRawExceptions(id, parameters, {
      version: 1,
      exceptions: [
        {
          storyId: id,
          rule: "color-contrast",
          owner: "@atlas/ui-owners",
          reason: "Fixture proves an approved exception passes",
          reviewedOn: "2026-01-01",
          expiry: "2099-01-01",
        },
      ],
    });
    expect(result).toEqual({ ok: true, failures: [], disabledRules: ["color-contrast"] });
  });

  it("5. fails when the matching exception is stale (expired)", () => {
    const storyWithRuleDisable = {
      ...CRITICAL_STORY_NO_A11Y,
      parameters: { a11y: { config: { rules: { "color-contrast": { enabled: false } } } } },
    };
    const { id, parameters } = composedA11yParameters(
      storyWithRuleDisable,
      META_NO_A11Y,
      undefined,
      "RuleDisableWithStaleException"
    );
    const result = evaluateWithRawExceptions(id, parameters, {
      version: 1,
      exceptions: [
        {
          storyId: id,
          rule: "color-contrast",
          owner: "@atlas/ui-owners",
          reason: "Fixture proves a stale exception fails",
          reviewedOn: "2024-01-01",
          expiry: "2024-06-01",
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toMatch(/expired exception/);
    expect(result.failures.join("\n")).toMatch(/without a valid, unexpired exception/);
  });

  it("does not let an exception scoped to a different story authorize this story's rule disable", () => {
    const storyWithRuleDisable = {
      ...CRITICAL_STORY_NO_A11Y,
      parameters: { a11y: { config: { rules: { "color-contrast": { enabled: false } } } } },
    };
    const { id, parameters } = composedA11yParameters(
      storyWithRuleDisable,
      META_NO_A11Y,
      undefined,
      "RuleDisableWrongScope"
    );
    const result = evaluateWithRawExceptions(id, parameters, {
      version: 1,
      exceptions: [
        {
          storyId: "some-other-story--id",
          rule: "color-contrast",
          owner: "@atlas/ui-owners",
          reason: "Scoped to a different story",
          reviewedOn: "2026-01-01",
          expiry: "2099-01-01",
        },
      ],
    });
    expect(result.ok).toBe(false);
  });

  // Issue 3: a11y.options narrowing detection
  it("6. fails when story-level a11y.options is set (can narrow scan scope)", () => {
    const storyWithOptions = {
      ...CRITICAL_STORY_NO_A11Y,
      parameters: { a11y: { options: { runOnly: { type: "tag", values: ["wcag2a"] } } } },
    };
    const { id, parameters } = composedA11yParameters(
      storyWithOptions,
      META_NO_A11Y,
      undefined,
      "StoryLevelOptions"
    );
    const result = evaluateWithRawExceptions(id, parameters, { version: 1, exceptions: [] });
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toMatch(/a11y\.options is not allowed/);
  });

  it("7. fails when meta-level a11y.options is inherited by a protected story", () => {
    const metaWithOptions = {
      ...META_NO_A11Y,
      parameters: { a11y: { options: { runOnly: { type: "rule", values: ["color-contrast"] } } } },
    };
    const { id, parameters } = composedA11yParameters(
      CRITICAL_STORY_NO_A11Y,
      metaWithOptions,
      undefined,
      "InheritsMetaOptions"
    );
    // Prove the inheritance actually happened before asserting on the policy decision.
    expect(parameters.a11y?.options).toBeDefined();
    const result = evaluateWithRawExceptions(id, parameters, { version: 1, exceptions: [] });
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toMatch(/a11y\.options is not allowed/);
  });
});

describe("evaluateA11yRuntimePolicy configure-time config allowlist", () => {
  it("fails when disableOtherRules is true", () => {
    const result = evaluateA11yRuntimePolicy({
      storyId: "ui-fixture--story",
      parameters: { a11y: { config: { disableOtherRules: true } } },
      validExceptions: [],
      exceptionFileFailures: [],
    });
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toMatch(/disableOtherRules=true is not allowed/);
  });

  it("fails when checks are configured", () => {
    const result = evaluateA11yRuntimePolicy({
      storyId: "ui-fixture--story",
      parameters: {
        a11y: {
          config: {
            checks: [{ id: "color-contrast", enabled: false }],
          },
        },
      },
      validExceptions: [],
      exceptionFileFailures: [],
    });
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toMatch(/config\.checks is not allowed/);
  });

  it("fails on an unknown unsupported config key", () => {
    const result = evaluateA11yRuntimePolicy({
      storyId: "ui-fixture--story",
      parameters: { a11y: { config: { locale: { lang: "en" } } } },
      validExceptions: [],
      exceptionFileFailures: [],
    });
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toMatch(/config\.locale is not allowed/);
  });

  it("passes when only supported config.rules is present with an approved exception", () => {
    const storyId = "ui-fixture--story";
    const result = evaluateA11yRuntimePolicy({
      storyId,
      parameters: {
        a11y: { config: { rules: { "color-contrast": { enabled: false } } } },
      },
      validExceptions: [
        {
          storyId,
          rule: "color-contrast",
          owner: "@atlas/ui-owners",
          reason: "Approved per-rule exception",
          reviewedOn: "2026-01-01",
          expiry: "2099-01-01",
        },
      ],
      exceptionFileFailures: [],
    });
    expect(result).toEqual({ ok: true, failures: [], disabledRules: ["color-contrast"] });
  });
});

describe("validateA11yConfig", () => {
  it("returns no failures for undefined config", () => {
    expect(validateA11yConfig("ui-fixture--story", undefined)).toEqual([]);
  });
});

describe("validateA11yRules (nested config.rules allowlist)", () => {
  const storyId = "ui-fixture--story";

  const approvedColorContrastException = {
    storyId,
    rule: "color-contrast",
    owner: "@atlas/ui-owners",
    reason: "Approved per-rule exception",
    reviewedOn: "2026-01-01",
    expiry: "2099-01-01",
  };

  it("1. rejects array-form rule-level selector", () => {
    const failures = validateA11yRules(storyId, [{ id: "button-name", selector: ".foo" }]);
    expect(failures.join("\n")).toMatch(/unsupported properties \(selector\)/);
  });

  it("2. rejects array-form rule-level reviewOnFail", () => {
    const failures = validateA11yRules(storyId, [{ id: "color-contrast", reviewOnFail: true }]);
    expect(failures.join("\n")).toMatch(/unsupported properties \(reviewOnFail\)/);
  });

  it("3. rejects array-form unknown rule-level keys even when enabled is present", () => {
    const failures = validateA11yRules(storyId, [
      { id: "some-rule", enabled: true, customUnknownKey: "whatever" },
    ]);
    expect(failures.join("\n")).toMatch(/unsupported properties \(customUnknownKey\)/);
  });

  it("4. rejects malformed array-form rule entries", () => {
    expect(validateA11yRules(storyId, [{ enabled: false }]).join("\n")).toMatch(
      /requires a non-empty string id/
    );
    expect(validateA11yRules(storyId, [{ id: "button-name" }]).join("\n")).toMatch(
      /requires enabled to be a boolean/
    );
    expect(validateA11yRules(storyId, "not-an-array-or-map").join("\n")).toMatch(
      /must be an array or plain object map/
    );
  });

  it("5. passes array-form { id, enabled: false } with a valid exact exception", () => {
    const result = evaluateA11yRuntimePolicy({
      storyId,
      parameters: {
        a11y: { config: { rules: [{ id: "color-contrast", enabled: false }] } },
      },
      validExceptions: [approvedColorContrastException],
      exceptionFileFailures: [],
    });
    expect(result).toEqual({ ok: true, failures: [], disabledRules: ["color-contrast"] });
  });

  it("6. fails array-form { id, enabled: false } without a valid exception", () => {
    const result = evaluateA11yRuntimePolicy({
      storyId,
      parameters: {
        a11y: { config: { rules: [{ id: "color-contrast", enabled: false }] } },
      },
      validExceptions: [],
      exceptionFileFailures: [],
    });
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toMatch(/without a valid, unexpired exception/);
  });

  it("7. accepts ordinary enabled rules using only the supported array shape", () => {
    const failures = validateA11yRules(storyId, [
      { id: "color-contrast", enabled: true },
      { id: "button-name", enabled: true },
    ]);
    expect(failures).toEqual([]);

    const result = evaluateA11yRuntimePolicy({
      storyId,
      parameters: {
        a11y: {
          config: {
            rules: [
              { id: "color-contrast", enabled: true },
              { id: "button-name", enabled: true },
            ],
          },
        },
      },
      validExceptions: [],
      exceptionFileFailures: [],
    });
    expect(result).toEqual({ ok: true, failures: [], disabledRules: [] });
  });

  it("rejects map-form nested extra keys", () => {
    const failures = validateA11yRules(storyId, {
      "color-contrast": { enabled: false, reviewOnFail: true },
    });
    expect(failures.join("\n")).toMatch(/unsupported properties \(reviewOnFail\)/);
  });

  it("accepts map-form { enabled: boolean } with an approved exception", () => {
    const result = evaluateA11yRuntimePolicy({
      storyId,
      parameters: {
        a11y: { config: { rules: { "color-contrast": { enabled: false } } } },
      },
      validExceptions: [approvedColorContrastException],
      exceptionFileFailures: [],
    });
    expect(result).toEqual({ ok: true, failures: [], disabledRules: ["color-contrast"] });
  });
});
