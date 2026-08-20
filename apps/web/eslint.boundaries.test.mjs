import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { ESLint } from "eslint";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COMPONENT_FILE = path.join(__dirname, "src/components/GlobalErrorHandler.tsx");
const LIB_FILE = path.join(__dirname, "src/lib/analytics/index.ts");

async function lintSnippet(code, filePath) {
  const eslint = new ESLint({ cwd: __dirname });
  const [result] = await eslint.lintText(code, { filePath });
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
        code: 'import { env } from "@/env";\n',
        ruleId: "no-restricted-imports",
        fragment: "@/env",
      },
      {
        code: 'import posthog from "posthog-js";\n',
        ruleId: "no-restricted-imports",
        fragment: "PostHog",
      },
      {
        code: 'import { cn } from "@/lib/utils";\n',
        ruleId: "no-restricted-imports",
        fragment: "@atlas/ui",
      },
      {
        code: 'import { Button } from "../../../../packages/ui/src/components/ui/button";\n',
        ruleId: "no-restricted-imports",
        fragment: "public package exports",
      },
      {
        code: "process.env.SOMETHING;\n",
        ruleId: "no-restricted-syntax",
        fragment: "process.env",
      },
      {
        code: 'fetch("/api/foo");\n',
        ruleId: "no-restricted-syntax",
        fragment: "fetch",
      },
    ];

    for (const testCase of cases) {
      const messages = await lintSnippet(testCase.code, COMPONENT_FILE);
      assertRuleViolation(messages, testCase.ruleId, testCase.fragment);
    }
  });

  it("accepts public API and config facade patterns", async () => {
    const componentCode = [
      'import { Button, cn } from "@atlas/ui";',
      'import { analytics } from "@/lib/analytics";',
      "",
      "void Button;",
      "void cn;",
      "void analytics;",
    ].join("\n");

    const libCode = [
      'import { getServerConfig } from "@/config/server";',
      "",
      "void getServerConfig;",
    ].join("\n");

    const componentMessages = await lintSnippet(componentCode, COMPONENT_FILE);
    assertNoRuleViolation(componentMessages, [
      "no-restricted-imports",
      "no-restricted-syntax",
      "no-restricted-globals",
    ]);

    const libMessages = await lintSnippet(libCode, LIB_FILE);
    assertNoRuleViolation(libMessages, ["no-restricted-imports", "no-restricted-syntax"]);
  });
});
