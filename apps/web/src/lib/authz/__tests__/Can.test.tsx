import { render, screen } from "@testing-library/react";

import { permissions } from "@/lib/authz/permissions";
import { Can } from "@/lib/authz/client/Can";

const mockUseSession = jest.fn();

jest.mock("@/lib/auth", () => ({
  useSession: () => mockUseSession(),
}));

describe("Can presentation helper", () => {
  it("renders children when permission is granted", () => {
    mockUseSession.mockReturnValue({
      status: "authenticated",
      permissions: [permissions.users.delete],
    });

    render(
      <Can permission={permissions.users.delete}>
        <button type="button">Delete</button>
      </Can>
    );

    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("omits children when permission is denied", () => {
    mockUseSession.mockReturnValue({
      status: "authenticated",
      permissions: [permissions.users.read],
    });

    render(
      <Can permission={permissions.users.delete} fallback={<span>Denied</span>}>
        <button type="button">Delete</button>
      </Can>
    );

    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.getByText("Denied")).toBeInTheDocument();
  });

  it("does not grant permissions when unauthenticated", () => {
    mockUseSession.mockReturnValue({
      status: "unauthenticated",
      permissions: null,
    });

    render(
      <Can permission={permissions.users.read}>
        <button type="button">View</button>
      </Can>
    );

    expect(screen.queryByRole("button", { name: "View" })).not.toBeInTheDocument();
  });
});
