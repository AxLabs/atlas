import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "@jest/globals";

import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  it("renders with default classes", () => {
    render(<Skeleton data-testid="skeleton" />);
    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toHaveClass("animate-pulse", "rounded-md", "bg-muted");
  });

  it("applies custom className", () => {
    render(<Skeleton className="h-4 w-full" data-testid="skeleton" />);
    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toHaveClass("h-4", "w-full");
  });
});
