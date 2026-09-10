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
