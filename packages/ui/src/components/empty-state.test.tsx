import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";

import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState title="No data" />);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<EmptyState title="No data" description="Try adding some items" />);
    expect(screen.getByText("Try adding some items")).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    render(<EmptyState title="No data" icon={<span data-testid="icon">📦</span>} />);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("renders action when provided", () => {
    render(<EmptyState title="No data" action={<button type="button">Add Item</button>} />);
    expect(screen.getByRole("button", { name: "Add Item" })).toBeInTheDocument();
  });
});
