import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

import { Button } from "../button";

describe("Button", () => {
  it("renders with data-slot attribute", () => {
    const { container } = render(<Button>Save</Button>);
    expect(container.querySelector('[data-slot="button"]')).toBeInTheDocument();
  });

  it("renders all public variants", () => {
    const variants = ["default", "secondary", "outline", "ghost", "destructive", "link"] as const;

    for (const variant of variants) {
      const { unmount } = render(
        <Button variant={variant}>{variant === "default" ? "Primary" : variant}</Button>
      );
      expect(screen.getByRole("button")).toBeInTheDocument();
      unmount();
    }
  });

  it("differentiates secondary and outline variants", () => {
    const { container: secondaryContainer } = render(
      <Button variant="secondary">Secondary</Button>
    );
    const { container: outlineContainer } = render(<Button variant="outline">Outline</Button>);

    const secondary = secondaryContainer.querySelector('[data-slot="button"]');
    const outline = outlineContainer.querySelector('[data-slot="button"]');

    expect(secondary).toHaveClass("bg-control-secondary-background");
    expect(outline).toHaveClass("bg-control-outline-background");
    expect(secondary?.className).not.toEqual(outline?.className);
  });

  it("supports disabled state", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("disabled");
  });

  it("handles click when enabled", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();

    render(<Button onClick={onClick}>Click me</Button>);
    await user.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
