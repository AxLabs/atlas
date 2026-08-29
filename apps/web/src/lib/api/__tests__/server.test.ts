/**
 * @jest-environment node
 */

import { fetchWithContext } from "@/lib/http/fetch-with-context.server";

import { serverApiDelete, serverApiGet, serverApiPost, serverApiRequest } from "../server";
import { getApiBaseUrl } from "../config";

jest.mock("@/lib/http/fetch-with-context.server", () => ({
  fetchWithContext: jest.fn(),
}));

jest.mock("../config", () => ({
  getApiBaseUrl: jest.fn(),
}));

const fetchMock = fetchWithContext as jest.MockedFunction<typeof fetchWithContext>;
const baseUrlMock = getApiBaseUrl as jest.MockedFunction<typeof getApiBaseUrl>;

describe("serverApiRequest", () => {
  beforeEach(() => {
    baseUrlMock.mockResolvedValue("https://api.example.com");
    fetchMock.mockReset();
  });

  it("prefixes relative endpoints and forwards the JSON body", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "1" }), {
        status: 200,
        headers: { "content-type": "application/json", "x-request-id": "server-corr" },
      })
    );

    await expect(serverApiPost("/users", { name: "Ada" })).resolves.toEqual({ id: "1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/users",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Ada" }),
      })
    );
  });

  it("preserves absolute URLs", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    await serverApiGet("https://other.example/health");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://other.example/health",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("returns undefined for 204", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(serverApiDelete("/users/1")).resolves.toBeUndefined();
  });

  it("throws a safe ApiError for invalid JSON", async () => {
    fetchMock.mockResolvedValue(
      new Response("{bad", {
        status: 200,
        headers: { "content-type": "application/json", "x-request-id": "corr" },
      })
    );

    await expect(serverApiRequest("/users")).rejects.toMatchObject({
      shape: { code: "INVALID_RESPONSE", correlationId: "corr" },
    });
  });

  it("maps a 401 into a safe user message", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ nope: true }), {
        status: 401,
        statusText: "Unauthorized",
        headers: { "content-type": "application/json" },
      })
    );
    await expect(serverApiGet("/secret")).rejects.toMatchObject({
      status: 401,
      shape: { userMessage: "You need to sign in to continue." },
    });
  });

  it("preserves a standard Atlas error body", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "VALIDATION_FAILED",
          message: "invalid",
          userMessage: "Fix it",
          details: { fieldErrors: { email: ["x"] } },
        }),
        { status: 422, headers: { "content-type": "application/json", "x-request-id": "c1" } }
      )
    );
    await expect(serverApiPost("/users", {})).rejects.toMatchObject({
      shape: { code: "VALIDATION_FAILED", correlationId: "c1", userMessage: "Fix it" },
    });
  });

  it("does not leak HTML error bodies to userMessage", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>secret</html>", {
        status: 500,
        statusText: "Error",
        headers: { "content-type": "text/html" },
      })
    );

    await expect(serverApiGet("/users")).rejects.toMatchObject({
      shape: { code: "HTTP_500", userMessage: expect.not.stringContaining("secret") },
    });
  });
});
