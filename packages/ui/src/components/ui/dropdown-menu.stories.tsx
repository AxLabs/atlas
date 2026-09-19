import { expect, screen, userEvent, waitFor, within } from "@storybook/test";
import {
  Cloud,
  CreditCard,
  Github,
  Keyboard,
  LifeBuoy,
  LogOut,
  Mail,
  MessageSquare,
  Plus,
  PlusCircle,
  Settings,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import * as React from "react";

import { skipStoryPlay } from "../../lib/skip-story-play";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu";

import type { Meta, StoryObj } from "@storybook/react";

const triggerButtonClassName =
  "ring-offset-background focus-visible:ring-ring border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50";

const meta: Meta<typeof DropdownMenu> = {
  title: "UI/DropdownMenu",
  component: DropdownMenu,
  parameters: {
    layout: "centered",
    docs: {
      story: {
        inline: false,
        iframeHeight: 500,
      },
    },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof DropdownMenu>;

export const Simple: Story = {
  render: () => (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            style={{
              padding: "8px 16px",
              border: "1px solid #ccc",
              borderRadius: "6px",
              background: "white",
              cursor: "pointer",
            }}
          />
        }
      >
        Click Me
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuItem>Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const WithoutRender: Story = {
  render: () => (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        style={{
          padding: "8px 16px",
          border: "1px solid var(--color-border)",
          borderRadius: "6px",
          background: "var(--color-background)",
          cursor: "pointer",
        }}
      >
        Open Dropdown
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuItem>Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const Default: Story = {
  parameters: {
    layout: "padded",
    docs: {
      story: {
        inline: false,
        iframeHeight: 600,
      },
    },
  },
  render: () => (
    <div style={{ padding: "50px", minHeight: "500px" }}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger render={<button type="button" className={triggerButtonClassName} />}>
          Open
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <User />
              Profile
              <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <CreditCard />
              Billing
              <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings />
              Settings
              <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Keyboard />
              Keyboard shortcuts
              <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <Users />
              Team
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <UserPlus />
                Invite users
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>
                  <Mail />
                  Email
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <MessageSquare />
                  Message
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <PlusCircle />
                  More...
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem>
              <Plus />
              New Team
              <DropdownMenuShortcut>⌘+T</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Github />
            GitHub
          </DropdownMenuItem>
          <DropdownMenuItem>
            <LifeBuoy />
            Support
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <Cloud />
            API
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <LogOut />
            Log out
            <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ),
};

function KeyboardInteractionDemo() {
  const [selected, setSelected] = React.useState<string | null>(null);
  return (
    <div>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger render={<button type="button" className={triggerButtonClassName} />}>
          Open menu
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {/* Base UI MenuItem uses onClick for activation (keyboard Enter fires a synthetic click) */}
          <DropdownMenuItem onClick={() => setSelected("Profile")}>Profile</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSelected("Settings")}>Settings</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSelected("Logout")}>Logout</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {selected !== null && (
        <p data-testid="selected-item" style={{ marginTop: "8px", fontSize: "14px" }}>
          Selected: {selected}
        </p>
      )}
    </div>
  );
}

export const KeyboardInteraction: Story = {
  tags: ["critical"],
  render: () => <KeyboardInteractionDemo />,
  play: async ({ canvasElement }) => {
    if (skipStoryPlay()) {
      return;
    }
    const canvas = within(canvasElement);
    const trigger = await canvas.findByRole("button", { name: "Open menu" });

    // Keyboard-open moves DOM focus to the first item. Pointer-open often leaves focus on the
    // trigger, so a later ArrowDown would land on Profile and ArrowUp would wrap to Logout.
    // Assert focus (the keyboard contract) rather than Base UI's `data-highlighted` attribute —
    // menu item chrome uses `focus:` styles, and that attribute is not always present when the
    // menuitem is already the active descendant.
    trigger.focus();
    await userEvent.keyboard("{ArrowDown}");
    await screen.findByRole("menu");

    const profileItem = () => screen.getByRole("menuitem", { name: "Profile" });
    const settingsItem = () => screen.getByRole("menuitem", { name: "Settings" });

    await waitFor(() => expect(profileItem()).toHaveFocus());
    // Navigate down then back up to land on Profile, then Enter to activate it.
    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() => expect(settingsItem()).toHaveFocus());
    await userEvent.keyboard("{ArrowUp}");
    await waitFor(() => expect(profileItem()).toHaveFocus());
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    await expect(trigger).toHaveFocus();
    // Prove the intended item was activated, not just that the menu closed.
    // waitFor: React state update (onClick → setSelected) may commit asynchronously.
    await waitFor(() =>
      expect(canvas.getByTestId("selected-item")).toHaveTextContent("Selected: Profile")
    );
  },
};

/**
 * Dedicated axe story: menu is open when postVisit runs so axe scans the full portal surface.
 *
 * KeyboardInteraction closes the menu before postVisit — axe there only audits the closed trigger
 * state. This story opens the menu via its play function and leaves it open so axe can audit the
 * menu portal rendered into document.body.
 */
export const AxeOpenMenu: Story = {
  tags: ["critical"],
  parameters: {
    // axe-core 4.11 misreports color-contrast for oklch() colors. The menu items use
    // oklch(0.22 0.01 286) text on oklch(0.965 0.003 286)/oklch(1 0 0) backgrounds; actual
    // contrast ratios are 16:1 (highlighted) and 20:1 (default), both well above WCAG AA 4.5:1.
    // Exception registered in a11y-exceptions.json (expiry 2027-03-01 for axe-core upgrade check).
    a11y: {
      config: {
        rules: [{ id: "color-contrast", enabled: false }],
      },
    },
  },
  render: () => (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger render={<button type="button" className={triggerButtonClassName} />}>
        Open menu
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuItem>Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByRole("button", { name: "Open menu" });
    await userEvent.click(trigger);
    await screen.findByRole("menu");
    // Intentionally leave the menu open so postVisit/axe audits the portal surface.
  },
};
