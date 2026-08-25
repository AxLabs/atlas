import { screen, waitFor } from "@testing-library/react";

import { ApiError } from "@/lib/api/errors";

import { ReferenceObservabilityDemo } from "@/features/components/ReferenceObservabilityDemo";
import { renderWithProviders } from "@/test/helpers/render";

jest.mock("@/lib/api", () => ({
  apiGet: jest.fn(),
}));

const { apiGet } = jest.requireMock("@/lib/api") as { apiGet: jest.Mock };

describe("ReferenceObservabilityDemo", () => {
  beforeEach(() => {
    apiGet.mockRejectedValue(
      new ApiError(
        {
          code: "HTTP_500",
          message: "Simulated server error",
          userMessage: "Something went wrong",
          correlationId: "corr-test-123",
        },
        500
      )
    );
  });

  it("shows correlation ID after controlled failure", async () => {
    const { user } = renderWithProviders(<ReferenceObservabilityDemo />);

    await user.click(screen.getByRole("button", { name: "Trigger controlled failure" }));

    await waitFor(() => {
      expect(screen.getByText(/corr-test-123/)).toBeInTheDocument();
    });
  });
});
