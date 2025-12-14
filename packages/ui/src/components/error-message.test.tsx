import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "@jest/globals";
import userEvent from "@testing-library/user-event";

import { ErrorMessage } from "./error-message";

describe("ErrorMessage", () => {
  it("renders nothing when no error", () => {
    const { container } = render(<ErrorMessage error={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders error string", () => {
    render(<ErrorMessage error="Something failed" />);
    expect(screen.getByText("Something failed")).toBeInTheDocument();
  });

  it("renders Error object", () => {
    const error = new Error("Network error");
    render(<ErrorMessage error={error} />);
    expect(screen.getByText("Network error")).toBeInTheDocument();
  });

  it("renders custom title", () => {
    render(<ErrorMessage error="Error" title="Custom Error" />);
    expect(screen.getByText("Custom Error")).toBeInTheDocument();
  });

  it("calls retry callback", async () => {
    const user = userEvent.setup();
    let retried = false;
    render(<ErrorMessage error="Error" retry={() => (retried = true)} />);
    await user.click(screen.getByText("Try again"));
    expect(retried).toBe(true);
  });

  it("has correct role", () => {
    render(<ErrorMessage error="Error" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
