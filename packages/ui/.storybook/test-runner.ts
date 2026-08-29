import type { TestRunnerConfig } from "@storybook/test-runner";
import { checkA11y, injectAxe } from "axe-playwright";

const STORY_ROOT = "#storybook-root";

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
    const storyParameters =
      "parameters" in context
        ? ((context as { parameters?: { a11y?: { disable?: boolean; config?: unknown } } })
            .parameters ?? {})
        : {};
    const a11yConfig = storyParameters.a11y ?? {};

    if (a11yConfig.disable === true) {
      return;
    }

    const element = await page.$(STORY_ROOT);
    if (!element) {
      throw new Error(`Story root ${STORY_ROOT} was not found for ${context.id}`);
    }

    await checkA11y(page, STORY_ROOT, {
      axeOptions: a11yConfig.config as Record<string, unknown> | undefined,
      detailedReport: true,
      detailedReportOptions: {
        html: true,
      },
    });
  },
};

export default config;
