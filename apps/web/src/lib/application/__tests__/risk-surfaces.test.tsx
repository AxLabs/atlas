import { render, screen } from "@testing-library/react";

import { FeatureFlags, FeatureGuard } from "@/lib/feature-flags";
import { renderWithProviders } from "@/test";

describe("FeatureGuard", () => {
  it("renders children when the flag is on", () => {
    renderWithProviders(
      <FeatureGuard feature={FeatureFlags.EXAMPLE_FEATURE} fallback={<p>off</p>}>
        <p>on</p>
      </FeatureGuard>,
      { featureFlags: { example_feature: true } }
    );
    expect(screen.getByText("on")).toBeInTheDocument();
  });

  it("renders fallback when the flag is off", () => {
    renderWithProviders(
      <FeatureGuard feature={FeatureFlags.EXAMPLE_FEATURE} fallback={<p>off</p>}>
        <p>on</p>
      </FeatureGuard>,
      { featureFlags: { example_feature: false } }
    );
    expect(screen.getByText("off")).toBeInTheDocument();
  });

  it("renders killed fallback when the kill switch is on", () => {
    renderWithProviders(
      <FeatureGuard
        feature={FeatureFlags.EXAMPLE_FEATURE}
        fallback={<p>off</p>}
        killedFallback={<p>killed</p>}
      >
        <p>on</p>
      </FeatureGuard>,
      { featureFlags: { example_feature: true, kill_example_feature: true } }
    );
    expect(screen.getByText("killed")).toBeInTheDocument();
  });
});

describe("PermissionDenied", () => {
  it("renders a safe permission-denied state", async () => {
    const { PermissionDenied } = await import("@/components/authz/PermissionDenied");
    render(<PermissionDenied correlationId="corr-denied" />);
    expect(screen.getByRole("heading", { name: "Permission denied" })).toBeInTheDocument();
    expect(screen.getByText("corr-denied")).toBeInTheDocument();
  });
});
