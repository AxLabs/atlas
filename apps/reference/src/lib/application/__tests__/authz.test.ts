jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock("@/lib/logging/logger.server", () => ({
  log: {
    warn: jest.fn(),
  },
}));

const mockIsReferenceModeEnabled = jest.fn<boolean, []>();

jest.mock("@/config/reference", () => ({
  isReferenceModeEnabled: () => mockIsReferenceModeEnabled(),
}));

import { buildReferenceSessionData } from "@/lib/reference/auth/session-builder";
import { referenceResourcePolicy } from "@/lib/reference/auth/policy";

import { resolveAuthorizationContext } from "@/lib/authz/context";
import { PermissionDeniedError } from "@/lib/authz/errors";
import { permissions } from "@/lib/authz/permissions";
import { hasRegisteredResourcePolicy, registerResourcePolicy } from "@/lib/authz/policy";
import { registerPermissionResolver } from "@/lib/authz/resolvers";
import {
  ensureApplicationAuthzConfigured,
  requireResourcePermission,
  resetApplicationAuthzConfiguration,
} from "@/lib/application/authz";

jest.mock("@/lib/auth/server", () => ({
  getServerSession: jest.fn(),
}));

import { getServerSession } from "@/lib/auth/server";

import type { OAuthUser, SessionData } from "@/lib/auth/types";

const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

const REFERENCE_USER: OAuthUser = {
  provider: "reference",
  providerAccountId: "reference-user",
  principalId: "reference-user",
  email: "reference.user@atlas.local",
  name: "Reference User",
  avatarUrl: null,
};

const APP_USER: OAuthUser = {
  provider: "google",
  providerAccountId: "google-user-1",
  principalId: "google-user-1",
  email: "user@example.com",
  name: "App User",
  avatarUrl: null,
};

function buildAppSession(user: OAuthUser): SessionData {
  const now = 1_700_000_000;

  return {
    user,
    accessToken: "app-access-token",
    refreshToken: "app-refresh-token",
    accessTokenExpiresAt: now + 60_000,
    createdAt: now,
    expiresAt: now + 3_600_000,
  };
}

function registerApplicationUpdatePermission(): void {
  registerPermissionResolver("application", () => [permissions.users.update]);
}

describe("application authz composition", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetApplicationAuthzConfiguration();
    mockIsReferenceModeEnabled.mockReturnValue(false);
  });

  describe("reference mode disabled", () => {
    it("does not register reference resolver or resource policy", () => {
      ensureApplicationAuthzConfigured();

      expect(hasRegisteredResourcePolicy()).toBe(false);
      expect(resolveAuthorizationContext(REFERENCE_USER).permissions).toEqual([]);
    });

    it("does not grant reference permissions to reference users", () => {
      ensureApplicationAuthzConfigured();

      const ctx = resolveAuthorizationContext(REFERENCE_USER);
      expect(ctx.permissions).toEqual([]);
    });
  });

  describe("reference mode enabled", () => {
    beforeEach(() => {
      mockIsReferenceModeEnabled.mockReturnValue(true);
    });

    it("registers reference resolver and resource policy", () => {
      ensureApplicationAuthzConfigured();

      expect(hasRegisteredResourcePolicy()).toBe(true);

      const userCtx = resolveAuthorizationContext(REFERENCE_USER);
      const adminCtx = resolveAuthorizationContext(
        buildReferenceSessionData("reference-admin")!.user
      );

      expect(userCtx.permissions).toEqual([permissions.users.read]);
      expect(adminCtx.permissions).toContain(permissions.users.delete);
    });

    it("denies reference-admin update of protected account via reference resource policy", async () => {
      ensureApplicationAuthzConfigured();
      const session = buildReferenceSessionData("reference-admin");
      mockedGetServerSession.mockResolvedValue(session);

      await expect(
        requireResourcePermission(permissions.users.update, {
          resourceType: "users",
          resourceId: "reference-admin",
        })
      ).rejects.toBeInstanceOf(PermissionDeniedError);
    });
  });

  describe("idempotency", () => {
    beforeEach(() => {
      mockIsReferenceModeEnabled.mockReturnValue(true);
    });

    it("produces the same configuration when called twice", () => {
      ensureApplicationAuthzConfigured();
      const first = resolveAuthorizationContext(
        buildReferenceSessionData("reference-admin")!.user
      ).permissions;

      ensureApplicationAuthzConfigured();
      const second = resolveAuthorizationContext(
        buildReferenceSessionData("reference-admin")!.user
      ).permissions;

      expect(first).toEqual(second);
      expect(first).toContain(permissions.users.delete);
    });
  });

  describe("consumer policy coexistence", () => {
    it("keeps consumer policy when reference mode is disabled", async () => {
      registerResourcePolicy("consumer", ({ resourceId }) => resourceId !== "blocked-user");
      registerApplicationUpdatePermission();
      ensureApplicationAuthzConfigured();

      mockedGetServerSession.mockResolvedValue(buildAppSession(APP_USER));

      await expect(
        requireResourcePermission(permissions.users.update, {
          resourceType: "users",
          resourceId: "blocked-user",
        })
      ).rejects.toBeInstanceOf(PermissionDeniedError);
    });

    it("composes consumer and reference restrictions when reference mode is enabled", async () => {
      mockIsReferenceModeEnabled.mockReturnValue(true);
      registerResourcePolicy("consumer", ({ resourceId }) => resourceId !== "consumer-blocked");
      ensureApplicationAuthzConfigured();

      const session = buildReferenceSessionData("reference-admin");
      mockedGetServerSession.mockResolvedValue(session);

      await expect(
        requireResourcePermission(permissions.users.update, {
          resourceType: "users",
          resourceId: "consumer-blocked",
        })
      ).rejects.toBeInstanceOf(PermissionDeniedError);

      await expect(
        requireResourcePermission(permissions.users.update, {
          resourceType: "users",
          resourceId: "reference-admin",
        })
      ).rejects.toBeInstanceOf(PermissionDeniedError);

      await expect(
        requireResourcePermission(permissions.users.update, {
          resourceType: "users",
          resourceId: "reference-user",
        })
      ).resolves.toMatchObject({
        permissions: expect.arrayContaining([permissions.users.update]),
      });
    });
  });

  describe("non-reference principals unaffected by reference policy", () => {
    it("does not deny updates when resourceId matches protected reference id", async () => {
      registerApplicationUpdatePermission();
      ensureApplicationAuthzConfigured();

      expect(hasRegisteredResourcePolicy()).toBe(false);

      mockedGetServerSession.mockResolvedValue(buildAppSession(APP_USER));

      await expect(
        requireResourcePermission(permissions.users.update, {
          resourceType: "users",
          resourceId: "reference-admin",
        })
      ).resolves.toMatchObject({
        permissions: expect.arrayContaining([permissions.users.update]),
      });
    });

    it("reference policy callback allows non-reference principals", () => {
      expect(
        referenceResourcePolicy({
          principal: { id: "google-user-1", provider: "google" },
          resourceType: "users",
          resourceId: "reference-admin",
          action: permissions.users.update,
        })
      ).toBe(true);
    });
  });
});
