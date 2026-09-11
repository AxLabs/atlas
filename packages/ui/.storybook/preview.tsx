import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react";

import "../src/styles/globals.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      disable: true,
    },
    // Prevent addon-a11y from auto-running axe on every render. Atlas enforces accessibility via
    // the test-runner's postVisit (checkA11y with body scope + policy checks). When both run
    // concurrently the test-runner gets "Axe is already running". With manual:true developers can
    // still trigger axe from the Accessibility panel; the test-runner postVisit is unaffected.
    a11y: {
      manual: true,
    },
  },
  decorators: [
    withThemeByClassName({
      themes: {
        light: "",
        dark: "dark",
      },
      defaultTheme: "light",
    }),
    (Story) => (
      <div
        className="bg-background text-foreground"
        style={{
          minHeight: "400px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default preview;
