import { render, screen } from "@testing-library/react";

import { ReferenceUserArea } from "../ReferenceUserArea";

const mockUseSession = jest.fn();

jest.mock("@/lib/auth", () => ({
  useSession: () => mockUseSession(),
}));

describe("ReferenceUserArea", () => {
  beforeEach(() => {
    mockUseSession.mockReset();
  });

  it("renders a sign-in link when unauthenticated", () => {
    mockUseSession.mockReturnValue({
      status: "unauthenticated",
      user: null,
    });

    render(<ReferenceUserArea />);

    const signInLink = screen.getByRole("link", { name: "Sign in" });
    expect(signInLink).toHaveAttribute("href", "/harness");
    expect(signInLink).not.toHaveAttribute("role", "button");
  });

  it("renders a profile link when authenticated", () => {
    mockUseSession.mockReturnValue({
      status: "authenticated",
      user: {
        name: "Reference User",
        email: "reference.user@atlas.local",
      },
    });

    render(<ReferenceUserArea />);

    const profileLink = screen.getByRole("link", { name: "Profile" });
    expect(profileLink).toHaveAttribute("href", "/profile");
    expect(profileLink).not.toHaveAttribute("role", "button");
    expect(screen.getByText("Reference User")).toBeInTheDocument();
  });
});
