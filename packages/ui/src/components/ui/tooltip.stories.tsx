import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

import { expect, screen, userEvent, waitFor } from "@storybook/test";

import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

const triggerButtonStyle = {
  padding: "8px 16px",
  border: "1px solid #ccc",
  borderRadius: "6px",
  background: "white",
  cursor: "pointer",
  fontSize: "14px",
} as const;

const meta: Meta<typeof Tooltip> = {
  title: "UI/Tooltip",
  component: Tooltip,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <TooltipProvider delay={0}>
        <Story />
      </TooltipProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger render={<button type="button" style={triggerButtonStyle} />}>
        Hover me
      </TooltipTrigger>
      <TooltipContent>
        <p>Add to library</p>
      </TooltipContent>
    </Tooltip>
  ),
};

export const WithSide: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "16px" }}>
      <Tooltip>
        <TooltipTrigger render={<button type="button" style={triggerButtonStyle} />}>
          Top
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Tooltip on top</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger render={<button type="button" style={triggerButtonStyle} />}>
          Right
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>Tooltip on right</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger render={<button type="button" style={triggerButtonStyle} />}>
          Bottom
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Tooltip on bottom</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger render={<button type="button" style={triggerButtonStyle} />}>
          Left
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Tooltip on left</p>
        </TooltipContent>
      </Tooltip>
    </div>
  ),
};

export const KeyboardAccessibility: Story = {
  tags: ["critical"],
  render: () => {
    function TooltipKeyboardDemo() {
      const [open, setOpen] = React.useState(true);

      return (
        <Tooltip open={open} onOpenChange={setOpen}>
          <TooltipTrigger render={<button type="button" style={triggerButtonStyle} />}>
            Show tooltip
          </TooltipTrigger>
          <TooltipContent>
            <p>Keyboard accessible tooltip</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return <TooltipKeyboardDemo />;
  },
  play: async () => {
    await screen.findByRole("tooltip");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  },
};
