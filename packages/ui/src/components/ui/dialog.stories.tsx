import { expect, screen, userEvent, waitFor, within } from "@storybook/test";

import { skipStoryPlay } from "../../lib/skip-story-play";

import { Button } from "./button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { Input } from "./input";
import { Label } from "./label";

import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta<typeof Dialog> = {
  title: "UI/Dialog",
  component: Dialog,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Dialog>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>Open Dialog</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you absolutely sure?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete your account and remove your
            data from our servers.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  ),
};

export const WithForm: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button />}>Edit Profile</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile here. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input id="name" defaultValue="Pedro Duarte" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="username" className="text-right">
              Username
            </Label>
            <Input id="username" defaultValue="@peduarte" className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const WithCustomClose: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>Share</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share link</DialogTitle>
          <DialogDescription>Anyone who has this link will be able to view this.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="link" className="sr-only">
              Link
            </Label>
            <Input id="link" defaultValue="https://ui.shadcn.com/docs/installation" readOnly />
          </div>
          <Button type="submit" size="sm" className="px-3">
            Copy
          </Button>
        </div>
        <DialogFooter className="sm:justify-start">
          <DialogClose render={<Button type="button" variant="secondary" />}>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const KeyboardInteraction: Story = {
  tags: ["critical"],
  render: () => (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label="Open Dialog"
            style={{
              padding: "8px 16px",
              border: "1px solid #ccc",
              borderRadius: "6px",
              background: "white",
              cursor: "pointer",
              fontSize: "14px",
            }}
          />
        }
      >
        Open Dialog
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Keyboard dialog</DialogTitle>
          <DialogDescription>
            Opens from the trigger, receives focus, and closes with Escape.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline">
            Cancel
          </Button>
          <Button type="button">Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    if (skipStoryPlay()) {
      return;
    }
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Open Dialog" });

    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByRole("dialog")).toBeVisible());

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(trigger).toHaveFocus();
  },
};

/**
 * Dedicated axe story: dialog is open when postVisit runs so axe scans the full portal surface.
 *
 * KeyboardInteraction closes the dialog before postVisit — axe there only audits the closed trigger
 * state. This story renders with `defaultOpen` so the dialog (rendered into document.body via a
 * Base UI portal) is present during the axe scan. Use this story to prove axe catches violations
 * introduced inside the open dialog portal.
 */
export const AxeOpenDialog: Story = {
  tags: ["critical"],
  parameters: {
    // axe-core 4.11 false positive for oklch() CSS colors: dialog content uses
    // oklch-based tokens; actual contrast ratios exceed 6:1 (all WCAG AA-compliant).
    // Exception registered in a11y-exceptions.json (expiry 2027-03-01).
    a11y: {
      config: {
        rules: [{ id: "color-contrast", enabled: false }],
      },
    },
  },
  render: () => (
    <Dialog defaultOpen>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Accessible dialog</DialogTitle>
          <DialogDescription>
            This dialog is open by default so axe can audit the full portal surface.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline">
            Cancel
          </Button>
          <Button type="button">Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
