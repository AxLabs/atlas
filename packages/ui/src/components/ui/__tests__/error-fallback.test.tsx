import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

import { ErrorFallback } from "../error-fallback";

describe("ErrorFallback", () => {
  it("renders an accessible heading for the title", () => {
    render(
      <ErrorFallback title="Permission denied" description="You cannot access this resource." />
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Permission denied" })
    ).toBeInTheDocument();
  });

  it("exposes alert semantics for generic errors", () => {
    render(<ErrorFallback title="Something went wrong" />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders retry action accessibly", async () => {
    const onRetry = jest.fn();
    const user = userEvent.setup();

    render(<ErrorFallback title="Something went wrong" onRetry={onRetry} />);

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows correlation id when provided", () => {
    render(
      <ErrorFallback
        title="Something went wrong"
        correlationId="corr-123"
        description="Please try again."
      />
    );

    expect(screen.getByText("corr-123")).toBeInTheDocument();
  });

  it("prefers ApiError userMessage and hides raw messages in production", () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    render(
      <ErrorFallback
        error={{
          shape: { message: "secret stack", userMessage: "Try again later." },
        }}
      />
    );
    expect(screen.getByText("Try again later.")).toBeInTheDocument();
    expect(screen.queryByText("secret stack")).not.toBeInTheDocument();
    process.env.NODE_ENV = previous;
  });
});
