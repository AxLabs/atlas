import { screen } from "@testing-library/react";

import { ReferenceHarnessPanel } from "@/features/components/ReferenceHarnessPanel";
import { createTestQueryClient, fixtures, renderWithProviders } from "@/test";

import type { UseSessionReturn } from "@/lib/auth";

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

const cachedSuccessUsers = fixtures.api.userListSuccess();
const postResetSuccessUsers = {
  ...fixtures.api.userListSuccess(),
  data: [
    {
      id: "user-reset",
      email: "reset.user@example.com",
      name: "Reset User",
      createdAt: "2024-06-01T00:00:00Z",
      updatedAt: "2024-06-01T00:00:00Z",
    },
  ],
};

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

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {}
): Response {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 204 ? "No Content" : "OK",
    headers: new Headers(init.headers),
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  } as Response;
}

function abortError(): Error {
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

function createProductionLikeQueryClient() {
  return createTestQueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 10 * 60 * 1000,
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

describe("ReferenceHarnessPanel reset cache consistency", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("shows post-reset success data without blocking on delayed or failed preview requests", async () => {
    const emptyPreview = createDeferred<void>();
    const successPreview = createDeferred<void>();
    let servePostResetSuccess = false;

    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise((resolve, reject) => {
        const abort = () => reject(abortError());
        if (init?.signal?.aborted) {
          abort();
          return;
        }
        init?.signal?.addEventListener("abort", abort, { once: true });

        const url = requestUrl(input);
        const method = (init?.method ?? "GET").toUpperCase();

        void (async () => {
          try {
            if (method === "GET" && url.includes("/api/status")) {
              resolve(
                jsonResponse({
                  enabled: true,
                  disclosure: "Reference mode active",
                  usersScenarios: USERS_SCENARIOS,
                  apiBasePath: "/api",
                })
              );
              return;
            }

            if (method === "POST" && url.includes("/api/auth/session")) {
              resolve(jsonResponse({}));
              return;
            }

            if (method === "POST" && url.includes("/api/reset")) {
              servePostResetSuccess = true;
              resolve(jsonResponse({}));
              return;
            }

            if (method === "GET" && url.includes("/users")) {
              const scenario = /[?&]scenario=([^&]+)/.exec(url)?.[1] ?? null;

              if (scenario === "empty") {
                await emptyPreview.promise;
                resolve(jsonResponse(fixtures.errors.error500, { status: 500 }));
                return;
              }

              if (scenario === "success") {
                if (servePostResetSuccess) {
                  await successPreview.promise;
                  resolve(jsonResponse(postResetSuccessUsers));
                  return;
                }

                resolve(jsonResponse(cachedSuccessUsers));
                return;
              }
            }

            resolve(jsonResponse({ error: `unhandled ${method} ${url}` }, { status: 404 }));
          } catch (error) {
            reject(error);
          }
        })();
      });
    }) as typeof fetch;

    const session = mockSession();
    const { user } = renderWithProviders(<ReferenceHarnessPanel session={session} />, {
      queryClient: createProductionLikeQueryClient(),
    });

    expect(await screen.findByText("Alice Johnson (alice@example.com)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "empty" }));
    expect(await screen.findByText("Scenario set to empty")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading users" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset reference state" }));

    expect(await screen.findByText("Reference state reset")).toBeInTheDocument();
    expect(screen.queryByText("Reset User (reset.user@example.com)")).not.toBeInTheDocument();

    emptyPreview.resolve();
    expect(screen.getByText("Reference state reset")).toBeInTheDocument();

    successPreview.resolve();

    expect(await screen.findByText("Reset User (reset.user@example.com)")).toBeInTheDocument();
    expect(screen.getByText("Reference state reset")).toBeInTheDocument();
    expect(screen.queryByText("Alice Johnson (alice@example.com)")).not.toBeInTheDocument();
  });
});
