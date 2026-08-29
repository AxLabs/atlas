import { ErrorFallback } from "./error-fallback";

import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta<typeof ErrorFallback> = {
  title: "UI/ErrorFallback",
  component: ErrorFallback,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ErrorFallback>;

export const Default: Story = {
  tags: ["critical"],
  render: () => (
    <div style={{ width: "500px" }}>
      <ErrorFallback
        title="Unable to load data"
        description="We could not fetch the latest records. Try again in a moment."
        correlationId="req_01HXYZ"
        onRetry={() => undefined}
      />
    </div>
  ),
};

export const Inline: Story = {
  render: () => (
    <ErrorFallback
      variant="inline"
      title="Save failed"
      description="Your changes were not saved."
      onRetry={() => undefined}
    />
  ),
};
