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
      options: [
        "default",
        "primary",
        "secondary",
        "destructive",
        "outline",
        "success",
        "warning",
        "info",
      ],
      description: "The visual style variant of the badge",
    },
    size: {
      control: "select",
      options: ["xs", "sm", "default", "lg"],
      description: "The size of the badge",
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
      <Badge variant="primary">Primary</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="info">Info</Badge>
    </div>
  ),
};

const sizes = ["xs", "sm", "default", "lg"] as const;

export const TextOnlyBySize: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {sizes.map((size) => (
        <Badge key={size} size={size}>
          {size}
        </Badge>
      ))}
    </div>
  ),
};

export const IconPlusTextBySize: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {sizes.map((size) => (
        <Badge key={size} size={size} variant="success">
          <CircleCheck aria-hidden="true" />
          {size}
        </Badge>
      ))}
      {sizes.map((size) => (
        <Badge key={`warning-${size}`} size={size} variant="warning">
          <TriangleAlert aria-hidden="true" />
          {size}
        </Badge>
      ))}
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
              <Badge size="xs" variant="success">
                Active
              </Badge>
              <Badge size="xs" variant="warning">
                Retry
              </Badge>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  ),
};
