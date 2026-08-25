import { screen } from "@testing-library/react";

import { ReferenceCapabilityMap } from "@/features/components/ReferenceCapabilityMap";
import { REFERENCE_CAPABILITIES } from "@/lib/reference/capabilities";
import { renderWithProviders } from "@/test/helpers/render";

describe("ReferenceCapabilityMap", () => {
  it("renders capability links for routable demonstrated capabilities", () => {
    renderWithProviders(<ReferenceCapabilityMap />);

    const linkedCapability = REFERENCE_CAPABILITIES.find((cap) => cap.route === "/users");
    expect(linkedCapability).toBeDefined();

    expect(
      screen.getByRole("link", { name: linkedCapability?.label ?? "OpenAPI" })
    ).toHaveAttribute("href", "/users");

    expect(screen.getByRole("link", { name: "Authorization" })).toHaveAttribute(
      "href",
      "/authorization"
    );
    expect(screen.getByRole("link", { name: "Feature flags" })).toHaveAttribute(
      "href",
      "/platform"
    );
    expect(screen.getByRole("link", { name: "Theming" })).toHaveAttribute("href", "/settings");
  });

  it("groups capabilities under section headings", () => {
    renderWithProviders(<ReferenceCapabilityMap />);

    expect(screen.getByText("Application architecture")).toBeInTheDocument();
    expect(screen.getByText("Data & forms")).toBeInTheDocument();
    expect(screen.getByText("Identity & access")).toBeInTheDocument();
    expect(screen.getByText("Platform")).toBeInTheDocument();
  });
});
