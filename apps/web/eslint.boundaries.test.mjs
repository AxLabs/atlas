import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { ESLint } from "eslint";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FIXTURE_ROOT = path.join(__dirname, "src");

function fixturePath(...segments) {
  return path.join(FIXTURE_ROOT, ...segments);
}

async function lintFixture(...segments) {
  const eslint = new ESLint({ cwd: __dirname, ignore: false });
  const filePath = fixturePath(...segments);
  const [result] = await eslint.lintFiles([filePath]);
  return result.messages;
}

function assertRuleViolation(messages, ruleId, fragment) {
  const matches = messages.filter((message) => message.ruleId === ruleId);
  const match = fragment
    ? matches.find((message) => message.message.toLowerCase().includes(fragment.toLowerCase()))
    : matches[0];
  assert.ok(match, `expected ${ruleId} for: ${fragment ?? "(any message)"}`);
  if (fragment) {
    assert.ok(
      match.message.toLowerCase().includes(fragment.toLowerCase()),
      `expected message to mention "${fragment}", got: ${match.message}`,
    );
  }
}

function assertNoRuleViolation(messages, ruleIds, fragment) {
  for (const ruleId of ruleIds) {
    const matches = messages.filter((message) => message.ruleId === ruleId);
    const match = fragment
      ? matches.find((message) => message.message.toLowerCase().includes(fragment.toLowerCase()))
      : matches[0];
    assert.equal(
      match !== undefined,
      false,
      `did not expect ${ruleId}${fragment ? ` mentioning "${fragment}"` : ""}, got: ${JSON.stringify(messages)}`,
    );
  }
}

describe("eslint architecture boundaries (@atlas/web)", () => {
  it("rejects prohibited import and syntax patterns in ordinary app code", async () => {
    const cases = [
      {
        file: ["features", "eslint-boundaries", "prohibited-reference-import.ts"],
        ruleId: "no-restricted-imports",
        fragment: "reference or example modules",
      },
      {
        file: ["components", "eslint-boundaries", "prohibited-env-import.tsx"],
        ruleId: "no-restricted-imports",
        fragment: "@/env",
      },
      {
        file: ["components", "eslint-boundaries", "prohibited-posthog.ts"],
        ruleId: "no-restricted-imports",
        fragment: "PostHog",
      },
      {
        file: ["components", "eslint-boundaries", "prohibited-ui-alias.ts"],
        ruleId: "no-restricted-imports",
        fragment: "@atlas/ui",
      },
      {
        file: ["components", "eslint-boundaries", "prohibited-package-source.ts"],
        ruleId: "no-restricted-imports",
        fragment: "public package exports",
      },
      {
        file: ["components", "eslint-boundaries", "prohibited-process-env.ts"],
        ruleId: "no-restricted-syntax",
        fragment: "process.env",
      },
      {
        file: ["components", "eslint-boundaries", "prohibited-fetch.ts"],
        ruleId: "no-restricted-syntax",
        fragment: "fetch",
      },
    ];

    for (const testCase of cases) {
      const messages = await lintFixture(...testCase.file);
      assertRuleViolation(messages, testCase.ruleId, testCase.fragment);
    }
  });

  it("accepts public API and config facade patterns", async () => {
    const componentMessages = await lintFixture(
      "components",
      "eslint-boundaries",
      "allowed-public-api.tsx",
    );
    assertNoRuleViolation(componentMessages, [
      "no-restricted-imports",
      "no-restricted-syntax",
      "no-restricted-globals",
    ]);

    const libMessages = await lintFixture("lib", "eslint-boundaries", "allowed-config-facade.ts");
    assertNoRuleViolation(libMessages, ["no-restricted-imports", "no-restricted-syntax"]);
  });

  it("keeps unrelated import boundaries active in API routes", async () => {
    const allowedMessages = await lintFixture(
      "app",
      "api",
      "eslint-boundaries",
      "allowed",
      "route.ts",
    );
    assertNoRuleViolation(allowedMessages, [
      "no-restricted-imports",
      "no-restricted-syntax",
      "no-restricted-globals",
    ]);

    const violationMessages = await lintFixture(
      "app",
      "api",
      "eslint-boundaries",
      "fixture",
      "route.ts",
    );
    assertRuleViolation(violationMessages, "no-restricted-imports", "PostHog");
    assertRuleViolation(violationMessages, "no-restricted-imports", "public package exports");
    assertNoRuleViolation(violationMessages, ["no-restricted-syntax", "no-restricted-globals"]);
  });

  it("allows raw fetch but not process.env in monitoring routes", async () => {
    const realRouteMessages = await lintFixture("app", "monitoring", "route.ts");
    assertNoRuleViolation(realRouteMessages, ["no-restricted-syntax", "no-restricted-globals"]);

    const fixtureMessages = await lintFixture(
      "app",
      "monitoring",
      "eslint-boundaries",
      "route.ts",
    );
    assertRuleViolation(fixtureMessages, "no-restricted-syntax", "process.env");
    assertNoRuleViolation(fixtureMessages, ["no-restricted-globals"]);
  });

  it("allows process.env but not raw fetch in analytics provider files", async () => {
    const realProviderMessages = await lintFixture("providers", "analytics-provider.tsx");
    assertNoRuleViolation(realProviderMessages, ["no-restricted-syntax", "no-restricted-globals"]);

    const fixtureMessages = await lintFixture(
      "providers",
      "eslint-boundaries",
      "analytics-provider-fixture.tsx",
    );
    assertRuleViolation(fixtureMessages, "no-restricted-syntax", "fetch");
    assertRuleViolation(fixtureMessages, "no-restricted-imports", "public package exports");
    assertNoRuleViolation(fixtureMessages, ["no-restricted-syntax"], "process.env");
  });

  it("allows vendor SDK imports but keeps package boundaries in analytics adapters", async () => {
    const adapterMessages = await lintFixture(
      "lib",
      "analytics",
      "adapters",
      "eslint-boundaries",
      "adapter-fixture.ts",
    );
    assertNoRuleViolation(adapterMessages, ["no-restricted-imports"], "PostHog");
    assertRuleViolation(adapterMessages, "no-restricted-imports", "public package exports");
  });
});
