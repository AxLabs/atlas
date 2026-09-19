import { fireEvent, screen, waitFor } from "@testing-library/react";

import { ReferenceHarnessPanel } from "@/features/components/ReferenceHarnessPanel";
import { useReferenceStatus, useReferenceUserList } from "@/features/queries";
import { apiPost, ApiError } from "@/lib/api";
import { fixtures, renderWithProviders } from "@/test";

import type { UseSessionReturn } from "@/lib/auth";

jest.mock("@/features/queries", () => ({
  useReferenceStatus: jest.fn(),
  useReferenceUserList: jest.fn(),
}));

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return {
    ...actual,
    apiPost: jest.fn(),
  };
});

const USERS_SCENARIOS = [
  "success",
  "empty",
  "validation",
  "unauthorized",
  "forbidden",
  "server-error",
  "slow",
  "offline",
];

const mockedStatus = useReferenceStatus as jest.MockedFunction<typeof useReferenceStatus>;
const mockedUsers = useReferenceUserList as jest.MockedFunction<typeof useReferenceUserList>;
const mockedApiPost = apiPost as jest.MockedFunction<typeof apiPost>;

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function mockSession(overrides: Partial<UseSessionReturn> = {}): UseSessionReturn {
  return {
    status: "unauthenticated",
    user: null,
    provider: null,
    principalId: null,
    permissions: null,
    refresh: jest.fn().mockResolvedValue(undefined),
    logout: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockHarnessQueries() {
  const refetchUsers = jest.fn().mockResolvedValue(undefined);

  mockedStatus.mockReturnValue({
    data: {
      enabled: true,
      disclosure: "Reference mode active",
      usersScenarios: USERS_SCENARIOS,
      apiBasePath: "/api",
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useReferenceStatus>);

  mockedUsers.mockImplementation((scenario) => {
    if (scenario === "slow") {
      return {
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: refetchUsers,
      } as unknown as ReturnType<typeof useReferenceUserList>;
    }

    if (scenario === "server-error") {
      return {
        data: undefined,
        isLoading: false,
        isError: true,
        error: new ApiError(fixtures.errors.error500, 500),
        refetch: refetchUsers,
      } as unknown as ReturnType<typeof useReferenceUserList>;
    }

    return {
      data: fixtures.api.userListSuccess(),
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchUsers,
    } as unknown as ReturnType<typeof useReferenceUserList>;
  });

  return { refetchUsers };
}

describe("ReferenceHarnessPanel", () => {
  beforeEach(() => {
    mockedApiPost.mockReset();
    mockHarnessQueries();
  });

  it("disables overlapping persona and scenario controls until persistence finishes", async () => {
    const sessionHold = createDeferred<Record<string, never>>();
    mockedApiPost.mockReturnValue(sessionHold.promise);

    const session = mockSession();
    const { user } = renderWithProviders(<ReferenceHarnessPanel session={session} />);

    await user.click(screen.getByRole("button", { name: "reference-user" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "server-error" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "reference-admin" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Reset reference state" })).toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "server-error" }));
    expect(mockedApiPost).toHaveBeenCalledTimes(1);

    sessionHold.resolve({});

    expect(await screen.findByText("Persona set to reference-user")).toBeInTheDocument();
    expect(screen.queryByText(/Scenario set to/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "server-error" })).toBeEnabled();
  });

  it("keeps selected scenario and shows persistence errors when session save fails", async () => {
    mockedApiPost.mockRejectedValue(new ApiError(fixtures.errors.error500, 500));

    const session = mockSession();
    const { user } = renderWithProviders(<ReferenceHarnessPanel session={session} />);

    await user.click(screen.getByRole("button", { name: "server-error" }));

    expect(
      await screen.findByText("Something went wrong. Please try again later.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Scenario set to server-error")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "success" })).toBeEnabled();
  });

  it("shows control completion while a delayed preview request is still in flight", async () => {
    mockedApiPost.mockResolvedValue({});

    const session = mockSession();
    const { user } = renderWithProviders(<ReferenceHarnessPanel session={session} />);

    await user.click(screen.getByRole("button", { name: "slow" }));

    expect(await screen.findByText("Scenario set to slow")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading users" })).toBeInTheDocument();
    expect(screen.queryByText(/Alice Johnson/)).not.toBeInTheDocument();
  });

  it("does not overwrite successful control feedback when preview data fails", async () => {
    mockedApiPost.mockResolvedValue({});

    const session = mockSession();
    const { user } = renderWithProviders(<ReferenceHarnessPanel session={session} />);

    await user.click(screen.getByRole("button", { name: "server-error" }));

    expect(await screen.findByText("Scenario set to server-error")).toBeInTheDocument();
    expect(await screen.findByText("Users request failed")).toBeInTheDocument();
    expect(screen.getByText("Scenario set to server-error")).toBeInTheDocument();
  });
});
