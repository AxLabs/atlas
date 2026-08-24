import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CircleCheck } from "lucide-react";

import { Badge } from "../badge";

describe("Badge", () => {
  it("renders badge text", () => {
    render(<Badge>Status</Badge>);
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("renders with data-slot attribute", () => {
    const { container } = render(<Badge>Status</Badge>);
    expect(container.querySelector('[data-slot="badge"]')).toBeInTheDocument();
  });

  it("renders icon content", () => {
    const { container } = render(
      <Badge>
        <CircleCheck aria-hidden="true" />
        Status
      </Badge>
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("supports destructive variant", () => {
    const { container } = render(<Badge variant="destructive">Error</Badge>);
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge).toHaveClass("text-control-destructive-foreground");
  });

  it("supports semantic success variant", () => {
    const { container } = render(<Badge variant="success">Active</Badge>);
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge).toHaveClass("text-success-foreground");
    expect(badge).toHaveClass("border-transparent");
  });

  it("uses borderless semantic status variants", () => {
    const variants = ["success", "warning", "info"] as const;

    for (const variant of variants) {
      const { container, unmount } = render(<Badge variant={variant}>Status</Badge>);
      const badge = container.querySelector('[data-slot="badge"]');
      expect(badge).toHaveClass("border-transparent");
      unmount();
    }
  });
});
