import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { ErrorFallback } from "../error-fallback";

describe("ErrorFallback", () => {
  it("renders with default title", () => {
    render(<ErrorFallback />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders with custom title", () => {
    render(<ErrorFallback title="Custom error" />);
    expect(screen.getByText("Custom error")).toBeInTheDocument();
  });

  it("renders with description", () => {
    render(<ErrorFallback description="Please try again later" />);
    expect(screen.getByText("Please try again later")).toBeInTheDocument();
  });

  it("has alert role", () => {
    render(<ErrorFallback />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders retry button when onRetry is provided", async () => {
    const onRetry = jest.fn();
    render(<ErrorFallback onRetry={onRetry} />);

    const retryButton = screen.getByRole("button", { name: /try again/i });
    expect(retryButton).toBeInTheDocument();

    await userEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not render retry button when onRetry is not provided", () => {
    render(<ErrorFallback />);
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
  });

  it("renders correlation ID when provided", () => {
    render(<ErrorFallback correlationId="abc-123" />);
    expect(screen.getByText("abc-123")).toBeInTheDocument();
    expect(screen.getByText(/reference id/i)).toBeInTheDocument();
  });

  it("extracts correlation ID from ApiError", () => {
    const error = {
      shape: {
        code: "ERROR",
        message: "Error occurred",
        correlationId: "error-456",
      },
    };
    render(<ErrorFallback error={error} />);
    expect(screen.getByText("error-456")).toBeInTheDocument();
  });

  it("extracts user message from ApiError", () => {
    const error = {
      shape: {
        code: "VALIDATION_ERROR",
        message: "Technical message",
        userMessage: "Please check your input",
      },
    };
    render(<ErrorFallback error={error} />);
    expect(screen.getByText("Please check your input")).toBeInTheDocument();
  });

  it("prefers error user message over description prop", () => {
    const error = {
      shape: {
        code: "ERROR",
        message: "Technical",
        userMessage: "From error",
      },
    };
    render(<ErrorFallback error={error} description="From prop" />);
    expect(screen.getByText("From error")).toBeInTheDocument();
    expect(screen.queryByText("From prop")).not.toBeInTheDocument();
  });

  it("renders custom actions", () => {
    render(<ErrorFallback actions={<button>Contact support</button>} />);
    expect(screen.getByRole("button", { name: "Contact support" })).toBeInTheDocument();
  });

  it("applies default variant classes", () => {
    const { container } = render(<ErrorFallback />);
    const element = container.querySelector('[data-slot="error-fallback"]');
    expect(element).toHaveClass("border", "min-h-[400px]");
  });

  it("applies inline variant classes", () => {
    const { container } = render(<ErrorFallback variant="inline" />);
    const element = container.querySelector('[data-slot="error-fallback"]');
    expect(element).not.toHaveClass("min-h-[400px]");
    expect(element).toHaveClass("p-6");
  });

  it("applies custom className", () => {
    const { container } = render(<ErrorFallback className="custom-class" />);
    const element = container.querySelector('[data-slot="error-fallback"]');
    expect(element).toHaveClass("custom-class");
  });

  it("does not leak error message in production", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const error = new Error("Sensitive error message");
    render(<ErrorFallback error={error} />);

    expect(screen.queryByText("Sensitive error message")).not.toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });
});
