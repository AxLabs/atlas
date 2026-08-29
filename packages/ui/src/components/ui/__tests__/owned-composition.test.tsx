import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "../dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../dropdown-menu";
import { EmptyState } from "../empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../tooltip";

describe("Select Atlas composition", () => {
  it("exposes trigger size and selectable items without depending on Base UI internals", async () => {
    const user = userEvent.setup();
    render(
      <Select defaultValue="one">
        <SelectTrigger size="sm" aria-label="Choose">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="one">One</SelectItem>
          <SelectItem value="two">Two</SelectItem>
        </SelectContent>
      </Select>
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("data-size", "sm");
    await user.click(trigger);
    expect(await screen.findByRole("option", { name: "Two" })).toBeInTheDocument();
  });
});

describe("Dialog Atlas composition", () => {
  it("renders a close control by default and can hide it", () => {
    const { rerender } = render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Details</DialogTitle>
        </DialogContent>
      </Dialog>
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();

    rerender(
      <Dialog defaultOpen>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Details</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  it("opens from the Atlas trigger", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Opened</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("heading", { name: "Opened" })).toBeInTheDocument();
  });
});

describe("DropdownMenu Atlas composition", () => {
  it("opens a menu from the Atlas trigger slot", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Rename</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));
    expect(await screen.findByRole("menuitem", { name: "Rename" })).toBeInTheDocument();
  });
});

describe("Tooltip Atlas composition", () => {
  it("exposes tooltip slots around a trigger", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Hint</TooltipTrigger>
          <TooltipContent>More detail</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    await user.hover(screen.getByText("Hint"));
    expect(await screen.findByText("More detail")).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renders title, description, and actions", () => {
    render(
      <EmptyState
        title="No items yet"
        description="Create one to get started."
        actions={<button type="button">Create</button>}
      />
    );
    expect(screen.getByText("No items yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });

  it("uses a custom icon when provided", () => {
    render(<EmptyState title="Empty" icon={<span>icon</span>} />);
    expect(screen.getByText("icon")).toBeInTheDocument();
  });
});
