import { expect, screen, userEvent, waitFor, within } from "@storybook/test";

import { skipStoryPlay } from "../../lib/skip-story-play";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

import type { Meta, StoryObj } from "@storybook/react";

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
  render: () => (
    <Tooltip>
      <TooltipTrigger render={<button type="button" style={triggerButtonStyle} />}>
        Show tooltip
      </TooltipTrigger>
      <TooltipContent>
        <p>Keyboard accessible tooltip</p>
      </TooltipContent>
    </Tooltip>
  ),
  play: async ({ canvasElement }) => {
    if (skipStoryPlay()) {
      return;
    }
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Show tooltip" });

    await expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    trigger.focus();
    await waitFor(() => expect(screen.getByRole("tooltip")).toBeVisible());

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
    await expect(trigger).toHaveFocus();
  },
};

/**
 * Dedicated axe story: tooltip is visible when postVisit runs so axe scans the full portal surface.
 *
 * KeyboardAccessibility dismisses the tooltip before postVisit — axe there only audits the closed
 * trigger state. This story focuses the trigger via its play function and leaves it focused (and
 * the tooltip visible) so axe can audit the tooltip portal rendered into document.body.
 */
export const AxeOpenTooltip: Story = {
  tags: ["critical"],
  render: () => (
    <Tooltip>
      <TooltipTrigger render={<button type="button" style={triggerButtonStyle} />}>
        Show tooltip
      </TooltipTrigger>
      <TooltipContent>
        <p>Keyboard accessible tooltip</p>
      </TooltipContent>
    </Tooltip>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Show tooltip" });
    trigger.focus();
    await waitFor(() => expect(screen.getByRole("tooltip")).toBeVisible());
    // Intentionally leave the tooltip open so postVisit/axe audits the portal surface.
  },
};
