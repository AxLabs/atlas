import { expect, screen, userEvent, waitFor, within } from "@storybook/test";

import { skipStoryPlay } from "../../lib/skip-story-play";

import { Label } from "./label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./select";

import type { Meta, StoryObj } from "@storybook/react";

const frameworks = [
  { value: "next", label: "Next.js" },
  { value: "react", label: "React" },
  { value: "vue", label: "Vue" },
  { value: "svelte", label: "Svelte" },
] as const;

const meta: Meta<typeof Select> = {
  title: "UI/Select",
  component: Select,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Base UI Select primitive. Use these stories as the canonical `@atlas/ui` usage reference. Preserve upstream Base UI defaults unless the product deliberately requires an override. When option values differ from visible labels, pass `items` on `Select` so `SelectValue` can resolve the selected label.",
      },
    },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Canonical composition: `items` maps values to labels, `SelectGroup` groups options, and trigger width is a layout choice—not required for positioning.",
      },
    },
  },
  render: () => (
    <Select defaultValue="next" items={frameworks}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select a framework" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {frameworks.map((framework) => (
            <SelectItem key={framework.value} value={framework.value}>
              {framework.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};

export const MatchingValueLabels: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-45">
        <SelectValue placeholder="Select a fruit" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="Apple">Apple</SelectItem>
          <SelectItem value="Banana">Banana</SelectItem>
          <SelectItem value="Blueberry">Blueberry</SelectItem>
          <SelectItem value="Grapes">Grapes</SelectItem>
          <SelectItem value="Pineapple">Pineapple</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};

export const WithGroups: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-70">
        <SelectValue placeholder="Select a timezone" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>North America</SelectLabel>
          <SelectItem value="est">Eastern Standard Time (EST)</SelectItem>
          <SelectItem value="cst">Central Standard Time (CST)</SelectItem>
          <SelectItem value="mst">Mountain Standard Time (MST)</SelectItem>
          <SelectItem value="pst">Pacific Standard Time (PST)</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Europe</SelectLabel>
          <SelectItem value="gmt">Greenwich Mean Time (GMT)</SelectItem>
          <SelectItem value="cet">Central European Time (CET)</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor="framework">Framework</Label>
      <Select defaultValue="next" items={frameworks}>
        <SelectTrigger id="framework">
          <SelectValue placeholder="Select a framework" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {frameworks.map((framework) => (
              <SelectItem key={framework.value} value={framework.value}>
                {framework.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const KeyboardInteraction: Story = {
  tags: ["critical"],
  render: () => (
    <Select defaultValue="next" items={frameworks}>
      <SelectTrigger className="w-[180px]" aria-label="Framework">
        <SelectValue placeholder="Select a framework" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {frameworks.map((framework) => (
            <SelectItem key={framework.value} value={framework.value}>
              {framework.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
  play: async ({ canvasElement }) => {
    if (skipStoryPlay()) {
      return;
    }
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("combobox", { name: "Framework" });

    // Keyboard-open: mouse click + `alignItemWithTrigger` parks the pointer over the selected
    // option, so later ArrowDown can be treated as pointer modality and never move highlight.
    trigger.focus();
    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() => expect(screen.getByRole("listbox")).toBeVisible());

    const nextOption = () => screen.getByRole("option", { name: "Next.js" });
    const reactOption = () => screen.getByRole("option", { name: "React" });

    // Base UI highlights the selected option on a later animation frame. Wait before ArrowDown
    // or Enter re-commits "Next.js". Enter only commits the option that currently has DOM focus.
    await waitFor(() => expect(nextOption()).toHaveAttribute("data-highlighted"));
    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() => expect(reactOption()).toHaveAttribute("data-highlighted"));
    await waitFor(() => expect(reactOption()).toHaveFocus());

    await userEvent.keyboard("{Enter}");
    await expect(trigger).toHaveTextContent("React");
    // Wait for the listbox to be fully removed before play returns so the body-scoped axe scan
    // (postVisit) does not see a partially-dismissed listbox that lacks aria-input-field-name.
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());

    await userEvent.keyboard("{Escape}");
    await expect(trigger).toHaveFocus();
  },
};

/**
 * Dedicated axe story: listbox is open when postVisit runs so axe scans the full portal surface.
 *
 * KeyboardInteraction closes the listbox before postVisit — axe there only audits the closed
 * trigger state. This story opens the listbox via its play function and leaves it open so axe
 * can audit the listbox portal rendered into document.body.
 */
export const AxeOpenListbox: Story = {
  tags: ["critical"],
  render: () => (
    <Select defaultValue="next" items={frameworks}>
      <SelectTrigger className="w-[180px]" aria-label="Framework">
        <SelectValue placeholder="Select a framework" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {frameworks.map((framework) => (
            <SelectItem key={framework.value} value={framework.value}>
              {framework.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("combobox", { name: "Framework" });
    await userEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole("listbox")).toBeVisible());
    // Intentionally leave the listbox open so postVisit/axe audits the portal surface.
  },
};
