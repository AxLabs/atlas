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
  const match = messages.find((message) => message.ruleId === ruleId);
  assert.ok(match, `expected ${ruleId} for: ${fragment}`);
  if (fragment) {
    assert.ok(
      match.message.toLowerCase().includes(fragment.toLowerCase()),
      `expected message to mention "${fragment}", got: ${match.message}`,
    );
  }
}

function assertNoRuleViolation(messages, ruleIds) {
  for (const ruleId of ruleIds) {
    assert.equal(
      messages.some((message) => message.ruleId === ruleId),
      false,
      `did not expect ${ruleId}, got: ${JSON.stringify(messages)}`,
    );
  }
}

describe("eslint architecture boundaries (@atlas/web)", () => {
  it("rejects prohibited import and syntax patterns in app code", async () => {
    const cases = [
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
});
