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

  it("suppresses native WebKit search decorations for search inputs", () => {
    const { container } = render(<Input type="search" placeholder="Search" />);
    const input = container.querySelector('[data-slot="input"]');
    expect(input).toHaveClass("[&::-webkit-search-cancel-button]:hidden");
    expect(input).toHaveClass("[&::-webkit-search-decoration]:hidden");
    expect(input).toHaveClass("[&::-webkit-search-results-button]:hidden");
  });

  it("does not add search suppression classes for other input types", () => {
    const { container } = render(<Input type="text" placeholder="Name" />);
    const input = container.querySelector('[data-slot="input"]');
    expect(input).not.toHaveClass("[&::-webkit-search-cancel-button]:hidden");
  });
});
