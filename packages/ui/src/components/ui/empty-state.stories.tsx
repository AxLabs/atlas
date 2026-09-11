import { Button } from "./button";
import { EmptyState } from "./empty-state";

import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta<typeof EmptyState> = {
  title: "UI/EmptyState",
  component: EmptyState,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  tags: ["critical"],
  render: () => (
    // Responsive container: renders at full viewport width (up to 640px) so mobile visual
    // baselines capture actual responsive layout rather than an intentionally-overflowing 500px
    // fixed-width wrapper.
    <div style={{ width: "100%", maxWidth: "640px" }}>
      <EmptyState
        title="No projects yet"
        description="Create a project to start organizing your work."
        actions={
          <Button type="button" variant="outline">
            Create project
          </Button>
        }
      />
    </div>
  ),
};
