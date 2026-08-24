import { ArrowLeft, Pencil, Trash2 } from "lucide-react";

import { Badge } from "./badge";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Input } from "./input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Switch } from "./switch";
import { Textarea } from "./textarea";

import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta = {
  title: "Design System/Atlas",
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj;

/** Representative page-header action row: Back to list · Edit · Delete */
export const PageHeaderActions: Story = {
  render: () => (
    <div className="bg-background w-full p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-foreground text-xl font-medium tracking-tight">Customer</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage customer details and status.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline">
            <ArrowLeft data-icon="inline-start" />
            Back to list
          </Button>
          <Button>
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
          <Button variant="destructive">
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  ),
};

/** Realistic form screen composition */
export const FormScreen: Story = {
  render: () => (
    <div className="bg-background w-full p-8">
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <h1 className="text-foreground text-xl font-medium tracking-tight">Customer</h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm">
              <ArrowLeft data-icon="inline-start" />
              Back to list
            </Button>
            <Button size="sm">
              <Pencil data-icon="inline-start" />
              Edit
            </Button>
            <Button variant="destructive" size="sm">
              <Trash2 data-icon="inline-start" />
              Delete
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-foreground text-sm font-medium" htmlFor="ds-name">
              Name
            </label>
            <Input id="ds-name" defaultValue="John Appleseed" />
          </div>

          <div className="space-y-1.5">
            <label className="text-foreground text-sm font-medium" htmlFor="ds-status">
              Status
            </label>
            <Select defaultValue="active">
              <SelectTrigger id="ds-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-foreground text-sm font-medium" htmlFor="ds-notes">
              Notes
            </label>
            <Textarea id="ds-notes" placeholder="Add internal notes…" rows={3} />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="ds-notify" defaultChecked />
            <label className="text-foreground text-sm" htmlFor="ds-notify">
              Send notification on update
            </label>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-foreground text-sm font-medium" htmlFor="ds-featured">
              Featured customer
            </label>
            <Switch id="ds-featured" />
          </div>

          <div className="space-y-1.5">
            <label className="text-foreground text-sm font-medium" htmlFor="ds-invalid">
              Email (invalid)
            </label>
            <Input id="ds-invalid" aria-invalid defaultValue="not-an-email" />
          </div>
        </div>

        <div className="border-border-subtle flex items-center justify-end gap-2 border-t pt-4">
          <Button variant="secondary">Cancel</Button>
          <Button>Save changes</Button>
        </div>
      </div>
    </div>
  ),
};

export const ButtonVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2 p-8">
      <Button>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

export const ButtonSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2 p-8">
      <Button size="xs">Extra small</Button>
      <Button size="sm">Small</Button>
      <Button>Default</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const DisabledButtons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2 p-8">
      <Button disabled>Primary</Button>
      <Button variant="secondary" disabled>
        Secondary
      </Button>
      <Button variant="outline" disabled>
        Outline
      </Button>
      <Button variant="destructive" disabled>
        Destructive
      </Button>
    </div>
  ),
};

export const BadgeVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2 p-8">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="info">Info</Badge>
    </div>
  ),
};

export const SwitchStates: Story = {
  render: () => (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <Switch aria-label="Unchecked switch" />
          <span className="text-muted-foreground text-xs">Unchecked</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Switch defaultChecked aria-label="Checked switch" />
          <span className="text-muted-foreground text-xs">Checked</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Switch disabled aria-label="Disabled switch" />
          <span className="text-muted-foreground text-xs">Disabled</span>
        </div>
      </div>
    </div>
  ),
};

export const ControlStates: Story = {
  render: () => (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 p-8">
      <div className="space-y-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Text inputs
        </p>
        <Input placeholder="Default input" />
        <Input placeholder="Invalid input" aria-invalid defaultValue="bad@" />
        <Input placeholder="Disabled input" disabled />
      </div>

      <div className="space-y-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Select</p>
        <Select defaultValue="active">
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Checkbox
        </p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox id="ds-unchecked" aria-label="Unchecked" />
            <label className="text-sm" htmlFor="ds-unchecked">
              Unchecked
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="ds-checked" defaultChecked aria-label="Checked" />
            <label className="text-sm" htmlFor="ds-checked">
              Checked
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Switch</p>
        <div className="flex items-center gap-6">
          <Switch aria-label="Switch unchecked" />
          <Switch defaultChecked aria-label="Switch checked" />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Badges</p>
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
      </div>
    </div>
  ),
};

export const InputStates: Story = {
  render: () => (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 p-8">
      <Input placeholder="Default input" />
      <Input placeholder="Invalid input" aria-invalid defaultValue="bad@" />
      <Input placeholder="Disabled input" disabled />
    </div>
  ),
};
