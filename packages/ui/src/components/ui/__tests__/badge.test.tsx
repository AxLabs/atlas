import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CircleCheck } from "lucide-react";

import { Badge } from "../badge";

const sizes = ["xs", "sm", "default", "lg"] as const;

describe("Badge", () => {
  it.each(sizes)("renders text-only %s badges with leading-none alignment", (size) => {
    const { container } = render(<Badge size={size}>Status</Badge>);
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge).toHaveClass("leading-none");
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it.each(sizes)("renders icon-plus-text %s badges", (size) => {
    const { container } = render(
      <Badge size={size}>
        <CircleCheck aria-hidden="true" />
        Status
      </Badge>
    );
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge).toHaveClass("leading-none");
    expect(badge?.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("gives xs badges a stable fixed height", () => {
    const { container } = render(<Badge size="xs">XS</Badge>);
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge).toHaveClass("h-4");
    expect(badge).toHaveClass("px-1.5");
    expect(badge).toHaveClass("py-0");
  });
});
