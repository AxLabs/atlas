jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

import { buildReferenceSessionData } from "@/lib/reference/auth/session-builder";
import "@/lib/reference/auth/register";

import { permissions } from "@/lib/authz/permissions";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/lib/authz/errors";
import { authorizationErrorResponse, authorize, requirePermission } from "@/lib/authz/server";
import { resolveAuthorizationContext } from "@/lib/authz/context";

jest.mock("@/lib/auth/session", () => ({
  readSession: jest.fn(),
}));

jest.mock("@/lib/auth/server", () => ({
  getServerSession: jest.fn(),
}));

import { getServerSession } from "@/lib/auth/server";

const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

describe("server authorization enforcement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws AuthenticationRequiredError for anonymous requests", async () => {
    mockedGetServerSession.mockResolvedValue(null);

    await expect(requirePermission(permissions.users.read)).rejects.toBeInstanceOf(
      AuthenticationRequiredError
    );
  });

  it("returns 401 response for anonymous via authorizationErrorResponse", async () => {
    const response = authorizationErrorResponse(new AuthenticationRequiredError(), "corr-401");

    expect(response?.status).toBe(401);
    const body = await response?.json();
    expect(body?.code).toBe("UNAUTHORIZED");
  });

  it("denies reference-user protected delete permission", async () => {
    const session = buildReferenceSessionData("reference-user");
    mockedGetServerSession.mockResolvedValue(session);

    await expect(requirePermission(permissions.users.delete)).rejects.toBeInstanceOf(
      PermissionDeniedError
    );
  });

  it("returns 403 response for forbidden via authorizationErrorResponse", async () => {
    const response = authorizationErrorResponse(
      new PermissionDeniedError(permissions.users.delete),
      "corr-403"
    );

    expect(response?.status).toBe(403);
    const body = await response?.json();
    expect(body?.code).toBe("FORBIDDEN");
  });

  it("allows reference-admin protected delete permission", async () => {
    const session = buildReferenceSessionData("reference-admin");
    mockedGetServerSession.mockResolvedValue(session);

    const ctx = await requirePermission(permissions.users.delete);
    expect(ctx.permissions).toContain(permissions.users.delete);
  });

  it("produces materially different contexts for user vs admin", () => {
    const userSession = buildReferenceSessionData("reference-user");
    const adminSession = buildReferenceSessionData("reference-admin");

    const userCtx = resolveAuthorizationContext(userSession!.user);
    const adminCtx = resolveAuthorizationContext(adminSession!.user);

    expect(userCtx.permissions).toEqual([permissions.users.read]);
    expect(adminCtx.permissions).toContain(permissions.users.delete);
    expect(adminCtx.permissions.length).toBeGreaterThan(userCtx.permissions.length);
  });

  it("authorize throws when permission missing on existing context", () => {
    const session = buildReferenceSessionData("reference-user");
    const ctx = resolveAuthorizationContext(session!.user);

    expect(() => authorize(ctx, permissions.users.create)).toThrow(PermissionDeniedError);
  });
});
