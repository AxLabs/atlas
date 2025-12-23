import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Loader, InlineLoader, PageLoader } from "../loader";

describe("Loader", () => {
  it("renders with role status", () => {
    render(<Loader />);
    const loader = screen.getByRole("status");
    expect(loader).toBeInTheDocument();
  });

  it("renders with default label", () => {
    render(<Loader />);
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });

  it("renders with custom label", () => {
    render(<Loader label="Loading data" />);
    expect(screen.getByLabelText("Loading data")).toBeInTheDocument();
  });

  it("applies size variants", () => {
    const { container } = render(<Loader size="lg" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("size-8");
  });

  it("has aria-live polite", () => {
    render(<Loader />);
    const loader = screen.getByRole("status");
    expect(loader).toHaveAttribute("aria-live", "polite");
  });
});

describe("InlineLoader", () => {
  it("renders with role status", () => {
    render(<InlineLoader />);
    const loader = screen.getByRole("status");
    expect(loader).toBeInTheDocument();
  });

  it("renders with default label", () => {
    render(<InlineLoader />);
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });

  it("renders with custom label", () => {
    render(<InlineLoader label="Processing" />);
    expect(screen.getByLabelText("Processing")).toBeInTheDocument();
  });

  it("applies small size class", () => {
    const { container } = render(<InlineLoader />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("size-4");
  });
});

describe("PageLoader", () => {
  it("renders with role status", () => {
    render(<PageLoader />);
    const loader = screen.getByRole("status");
    expect(loader).toBeInTheDocument();
  });

  it("renders with default aria-label", () => {
    render(<PageLoader />);
    expect(screen.getByLabelText("Loading page")).toBeInTheDocument();
  });

  it("renders with custom title", () => {
    render(<PageLoader title="Loading your data" />);
    expect(screen.getByText("Loading your data")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading your data")).toBeInTheDocument();
  });

  it("renders with description", () => {
    render(<PageLoader title="Loading" description="Please wait a moment" />);
    expect(screen.getByText("Please wait a moment")).toBeInTheDocument();
  });

  it("has aria-live polite", () => {
    render(<PageLoader />);
    const loader = screen.getByRole("status");
    expect(loader).toHaveAttribute("aria-live", "polite");
  });

  it("applies custom className", () => {
    render(<PageLoader className="custom-class" />);
    const loader = screen.getByRole("status");
    expect(loader).toHaveClass("custom-class");
  });
});
