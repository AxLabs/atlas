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
    <div style={{ width: "500px" }}>
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
