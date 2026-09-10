import { getStoryContext, type TestRunnerConfig } from "@storybook/test-runner";
import { checkA11y, injectAxe } from "axe-playwright";
import path from "node:path";

import {
  evaluateA11yRuntimePolicy,
  loadA11yExceptionsFile,
  type EffectiveA11yParameters,
} from "../src/lib/a11y-runtime-policy";

const STORY_ROOT = "#storybook-root";
// `@storybook/test-runner` loads this file via `esbuild-register`'s CommonJS require hook (not a
// real ES module import), so use the ambient CJS `__dirname` rather than `import.meta.url` /
// `fileURLToPath`: the latter makes Node's loader treat this file as ESM-eligible, which crashes
// with "require is not defined in ES module scope" once esbuild-register's transpiled `require(...)`
// calls run inside that ESM evaluation.
declare const __dirname: string;
const EXCEPTIONS_PATH = path.join(__dirname, "a11y-exceptions.json");

function formatFailures(storyId: string, failures: string[]): string {
  return [
    `Accessibility policy failed for "${storyId}":`,
    ...failures.map((failure) => `  - ${failure}`),
  ].join("\n");
}

const config: TestRunnerConfig = {
  tags: {
    include: ["critical"],
    exclude: ["no-tests"],
  },
  async preVisit(page) {
    await injectAxe(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
  },
  async postVisit(page, context) {
    // Read Storybook's own effective, merged story context (global preview + component meta +
    // story parameters) instead of trusting `context`, which only carries id/title/name. This is
    // what makes inherited `a11y` configuration visible at runtime rather than only in source text.
    const storyContext = await getStoryContext(page, context);
    const parameters = (storyContext.parameters ?? {}) as { a11y?: EffectiveA11yParameters };

    const { valid: validExceptions, invalid } = loadA11yExceptionsFile(EXCEPTIONS_PATH);
    const exceptionFileFailures = invalid.flatMap((entry) => entry.failures);

    const policy = evaluateA11yRuntimePolicy({
      storyId: context.id,
      parameters,
      validExceptions,
      exceptionFileFailures,
    });

    if (!policy.ok) {
      // Fail closed: never silently skip axe because of an inherited or malformed a11y setting.
      throw new Error(formatFailures(context.id, policy.failures));
    }

    const element = await page.$(STORY_ROOT);
    if (!element) {
      throw new Error(`Story root ${STORY_ROOT} was not found for ${context.id}`);
    }

    await checkA11y(page, STORY_ROOT, {
      axeOptions: parameters.a11y?.config as Record<string, unknown> | undefined,
      detailedReport: true,
      detailedReportOptions: {
        html: true,
      },
    });
  },
};

export default config;
