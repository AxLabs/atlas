import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { Switch } from "../switch";

describe("Switch", () => {
  it("renders with data-slot attributes", () => {
    const { container } = render(<Switch aria-label="Notifications" />);

    expect(container.querySelector('[data-slot="switch"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="switch-thumb"]')).toBeInTheDocument();
  });

  it("exposes switch semantics", () => {
    render(<Switch aria-label="Notifications" />);
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("defaults to unchecked", () => {
    render(<Switch aria-label="Notifications" />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("supports checked state", () => {
    render(<Switch defaultChecked aria-label="Notifications" />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("supports disabled state", () => {
    render(<Switch disabled aria-label="Notifications" />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-disabled", "true");
  });

  it("uses switch thumb surface tokens", () => {
    const { container } = render(<Switch aria-label="Notifications" />);
    const thumb = container.querySelector('[data-slot="switch-thumb"]');

    expect(thumb).toHaveClass("bg-switch-thumb");
    expect(thumb).toHaveClass("border-switch-thumb-border");
  });
});
