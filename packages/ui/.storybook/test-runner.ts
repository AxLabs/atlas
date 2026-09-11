import { getStoryContext, type TestRunnerConfig } from "@storybook/test-runner";
import { checkA11y, configureAxe, injectAxe } from "axe-playwright";
import path from "node:path";

import {
  evaluateA11yRuntimePolicy,
  loadA11yExceptionsFile,
  type EffectiveA11yParameters,
} from "../src/lib/a11y-runtime-policy";

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
    // Deliberately no `exclude: ["no-tests"]`. A protected story with "no-tests" would previously
    // be silently omitted from execution. Now the postVisit check catches it and fails loudly,
    // making it impossible for a critical story to gain "no-tests" without breaking CI.
  },
  async preVisit(page) {
    await injectAxe(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    // Configure page-structure rules that are irrelevant for component-level testing in
    // Storybook's iframe context:
    //   - "region": requires all content to be inside landmark regions. Components are tested in
    //     isolation without a full page structure (no <main> etc.), so this fires on every story.
    //     It is a page-composition rule, not a component accessibility rule.
    await configureAxe(page, {
      rules: [{ id: "region", enabled: false }],
    });
  },
  async postVisit(page, context) {
    // Read Storybook's own effective, merged story context (global preview + component meta +
    // story parameters) instead of trusting `context`, which only carries id/title/name. This is
    // what makes inherited `a11y` configuration visible at runtime rather than only in source text.
    const storyContext = await getStoryContext(page, context);

    // Fail closed: a protected story must never carry "no-tests" at any tag level (story,
    // component meta, global preview). The tag instructs the test runner to skip execution, which
    // would silently bypass this entire postVisit check. Catching it here makes any "no-tests"
    // on a critical story an immediate, loud failure rather than a silent omission.
    if (storyContext.tags?.includes("no-tests")) {
      throw new Error(
        `Accessibility policy failed for "${context.id}": story has the "no-tests" tag ` +
          `(effective tags: ${JSON.stringify(storyContext.tags)}). A protected story must never ` +
          `be silently omitted from test execution. Remove "no-tests" from this story, its ` +
          `component meta, or any inherited tag source.`
      );
    }

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

    // Apply story-level axe configuration via axe.configure() (not axe.run() options). Storybook's
    // `a11y.config` maps to axe configure-time settings (rules, checks, locale). Passing it as
    // axeOptions to checkA11y would send it to axe.run() instead, silently ignoring the config.
    if (parameters.a11y?.config) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await configureAxe(page, parameters.a11y.config as any);
    }

    // Scan `body` instead of `#storybook-root`: portaled overlays (Dialog, Select, DropdownMenu,
    // Tooltip) render outside the Storybook root into document.body, so a root-scoped scan misses
    // them entirely. Body-scoped scanning ensures open portals are included in the axe audit.
    //
    // `[data-base-ui-focus-guard]` elements are Base UI's invisible focus sentinel spans used for
    // focus-trap implementation. They carry aria-hidden="true" with tabindex="0" by design, which
    // triggers axe's aria-hidden-focus rule as a false positive. Excluding them from the axe
    // context avoids this noise without silencing the rule for real component violations.
    await checkA11y(
      page,
      {
        include: [["body"]],
        exclude: [["[data-base-ui-focus-guard]"]],
      },
      {
        detailedReport: true,
        detailedReportOptions: {
          html: true,
        },
      }
    );
  },
};

export default config;
