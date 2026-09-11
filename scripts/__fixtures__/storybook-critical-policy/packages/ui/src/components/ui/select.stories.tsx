export const KeyboardInteraction: Story = {
  tags: ["autodocs"],
  play: async () => {},
};

export const KeyboardInteractionNoPlay: Story = {
  tags: ["critical"],
};

export const KeyboardInteractionA11yDisable: Story = {
  tags: ["critical"],
  parameters: {
    a11y: {
      disable: true,
    },
  },
  play: async () => {},
};

export const KeyboardInteractionRuleDisable: Story = {
  tags: ["critical"],
  parameters: {
    a11y: {
      config: {
        rules: {
          "color-contrast": { enabled: false },
        },
      },
    },
  },
  play: async () => {},
};

// Negative-test fixture: story-level "no-tests" on a protected story.
// The static policy detects this via the built Storybook index (where Storybook records effective
// tags). The runtime policy (test-runner.ts) detects it via storyContext.tags in postVisit.
export const KeyboardInteractionWithNoTests: Story = {
  tags: ["critical", "no-tests"],
  play: async () => {},
};
