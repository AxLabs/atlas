import { render } from "@testing-library/react";
import "@testing-library/jest-dom";

import { Input } from "../input";

describe("Input", () => {
  it("renders with data-slot attribute", () => {
    const { container } = render(<Input placeholder="Search" />);
    expect(container.querySelector('[data-slot="input"]')).toBeInTheDocument();
  });

  it("keeps semantic type=search", () => {
    const { container } = render(<Input type="search" placeholder="Search" />);
    const input = container.querySelector('[data-slot="input"]');
    expect(input).toHaveAttribute("type", "search");
  });

  it("applies placeholder", () => {
    render(<Input placeholder="Name" />);
    expect(document.querySelector("input")).toHaveAttribute("placeholder", "Name");
  });

  it("supports disabled state", () => {
    render(<Input disabled placeholder="Name" />);
    expect(document.querySelector("input")).toBeDisabled();
  });
});
