import { renderHook } from "@testing-library/react";

import { _resetClientConfigCache } from "@/config/client";

import { apiRequest } from "../client";
import { createApi } from "../contracts";
import { useApiClient, useTypedApiClient } from "../hooks";

jest.mock("../client", () => {
  const actual = jest.requireActual("../client") as typeof import("../client");
  return {
    ...actual,
    apiRequest: jest.fn(),
    apiGet: jest.fn((endpoint: string, options?: unknown) =>
      (jest.requireMock("../client") as { apiRequest: jest.Mock }).apiRequest(endpoint, {
        ...(options as object),
        method: "GET",
      })
    ),
    apiPost: jest.fn((endpoint: string, body?: unknown, options?: unknown) =>
      (jest.requireMock("../client") as { apiRequest: jest.Mock }).apiRequest(endpoint, {
        ...(options as object),
        method: "POST",
        body,
      })
    ),
    apiPatch: jest.fn((endpoint: string, body?: unknown, options?: unknown) =>
      (jest.requireMock("../client") as { apiRequest: jest.Mock }).apiRequest(endpoint, {
        ...(options as object),
        method: "PATCH",
        body,
      })
    ),
    apiDelete: jest.fn((endpoint: string, options?: unknown) =>
      (jest.requireMock("../client") as { apiRequest: jest.Mock }).apiRequest(endpoint, {
        ...(options as object),
        method: "DELETE",
      })
    ),
  };
});

const apiRequestMock = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe("useApiClient", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockResolvedValue({ ok: true });
    _resetClientConfigCache();
  });

  it("prefixes relative endpoints with the runtime base URL", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://runtime.example/api";
    _resetClientConfigCache();
    const { result } = renderHook(() => useApiClient());
    await result.current.get("/users");
    await result.current.put("/users/1", { name: "Ada" });
    await result.current.patch("/users/1", { name: "Ada" });
    await result.current.delete("/users/1");
    expect(apiRequestMock).toHaveBeenCalledWith(
      "https://runtime.example/api/users/1",
      expect.objectContaining({ method: "PUT" })
    );
    expect(apiRequestMock).toHaveBeenCalledWith(
      "https://runtime.example/api/users/1",
      expect.objectContaining({ method: "PATCH" })
    );
    expect(apiRequestMock).toHaveBeenCalledWith(
      "https://runtime.example/api/users/1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("preserves absolute endpoints", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://runtime.example/api";
    _resetClientConfigCache();
    const { result } = renderHook(() => useApiClient());
    await result.current.post("https://absolute.example/items", { n: 1 });
    expect(apiRequestMock).toHaveBeenCalledWith("https://absolute.example/items", {
      method: "POST",
      body: { n: 1 },
    });
  });

  it("rebinds when the runtime base URL changes", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://first.example";
    _resetClientConfigCache();
    const { result, rerender } = renderHook(() => useTypedApiClient());
    const first = result.current;

    process.env.NEXT_PUBLIC_API_URL = "https://second.example";
    _resetClientConfigCache();
    rerender();
    expect(result.current).not.toBe(first);

    apiRequestMock.mockResolvedValue({ data: [], meta: { page: 1 } });
    await result.current.users.list();
    expect(apiRequestMock).toHaveBeenCalledWith(
      "https://second.example/users",
      expect.objectContaining({ method: "GET" })
    );
  });
});

describe("createApi transport wrapper", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockResolvedValue({ ok: true });
  });

  it("appends list query parameters", async () => {
    const api = createApi("https://api.test");
    await api.users.list({ page: 2, pageSize: 10, search: "ada" });
    expect(apiRequestMock).toHaveBeenCalledWith(
      "https://api.test/users?page=2&pageSize=10&search=ada",
      expect.objectContaining({ method: "GET" })
    );
  });
});
