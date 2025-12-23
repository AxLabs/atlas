import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { EmptyState } from "../empty-state";

describe("EmptyState", () => {
  it("renders with title", () => {
    render(<EmptyState title="No results found" />);
    expect(screen.getByRole("heading", { name: "No results found" })).toBeInTheDocument();
  });

  it("renders with description", () => {
    render(<EmptyState title="No data" description="Try adjusting your filters" />);
    expect(screen.getByText("Try adjusting your filters")).toBeInTheDocument();
  });

  it("renders default icon when no icon provided", () => {
    const { container } = render(<EmptyState title="Empty" />);
    const icon = container.querySelector("svg");
    expect(icon).toBeInTheDocument();
  });

  it("renders custom icon", () => {
    render(<EmptyState title="Empty" icon={<div data-testid="custom-icon">Custom</div>} />);
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("renders with no icon when icon is null", () => {
    const { container } = render(<EmptyState title="Empty" icon={null} />);
    const iconContainer = container.querySelector('[aria-hidden="true"]');
    expect(iconContainer).not.toBeInTheDocument();
  });

  it("renders action buttons", () => {
    render(<EmptyState title="Empty" actions={<button>Create new</button>} />);
    expect(screen.getByRole("button", { name: "Create new" })).toBeInTheDocument();
  });

  it("applies default variant classes", () => {
    const { container } = render(<EmptyState title="Empty" />);
    const element = container.querySelector('[data-slot="empty-state"]');
    expect(element).toHaveClass("border", "border-dashed", "rounded-lg");
  });

  it("applies compact variant classes", () => {
    const { container } = render(<EmptyState title="Empty" variant="compact" />);
    const element = container.querySelector('[data-slot="empty-state"]');
    expect(element).not.toHaveClass("border");
    expect(element).toHaveClass("p-6");
  });

  it("applies custom className", () => {
    const { container } = render(<EmptyState title="Empty" className="custom-class" />);
    const element = container.querySelector('[data-slot="empty-state"]');
    expect(element).toHaveClass("custom-class");
  });

  it("has proper heading", () => {
    render(<EmptyState title="No items" />);
    const heading = screen.getByRole("heading", { name: "No items" });
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe("H3");
  });
});
