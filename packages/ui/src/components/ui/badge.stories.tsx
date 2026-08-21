import { CircleCheck, TriangleAlert } from "lucide-react";

import { Badge } from "./badge";

import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "destructive", "outline", "ghost", "link"],
      description: "The visual style variant of the badge",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: {
    children: "Badge",
  },
};

export const Secondary: Story = {
  args: {
    children: "Secondary",
    variant: "secondary",
  },
};

export const Destructive: Story = {
  args: {
    children: "Destructive",
    variant: "destructive",
  },
};

export const Outline: Story = {
  args: {
    children: "Outline",
    variant: "outline",
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="ghost">Ghost</Badge>
      <Badge variant="link">Link</Badge>
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="secondary">
        <CircleCheck aria-hidden="true" />
        Active
      </Badge>
      <Badge variant="destructive">
        <TriangleAlert aria-hidden="true" />
        Retry
      </Badge>
    </div>
  ),
};

export const CompactTableRow: Story = {
  render: () => (
    <table className="w-full max-w-md text-sm">
      <tbody>
        <tr>
          <td className="py-2 align-middle">Queue item</td>
          <td className="py-2 align-middle">
            <div className="flex flex-wrap items-center gap-1.5 leading-none">
              <Badge variant="secondary">Active</Badge>
              <Badge variant="destructive">Retry</Badge>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  ),
};
