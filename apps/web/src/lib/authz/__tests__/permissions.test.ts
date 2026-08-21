import { can, hasPermission } from "@/lib/authz/check";
import { resolveAuthorizationContext } from "@/lib/authz/context";
import { permissions } from "@/lib/authz/permissions";
import { principalFromUser } from "@/lib/authz/principal";
import { registerPermissionResolver, resetPermissionResolvers } from "@/lib/authz/resolvers";
import { referenceRolesToPermissions } from "@/lib/reference/auth/permissions";

import type { OAuthUser } from "@/lib/auth/types";

const REFERENCE_USER: OAuthUser = {
  provider: "reference",
  providerAccountId: "reference-user",
  principalId: "reference-user",
  email: "reference.user@atlas.local",
  name: "Reference User",
  avatarUrl: null,
};

const REFERENCE_ADMIN: OAuthUser = {
  provider: "reference",
  providerAccountId: "reference-admin",
  principalId: "reference-admin",
  email: "reference.admin@atlas.local",
  name: "Reference Admin",
  avatarUrl: null,
};

beforeEach(() => {
  resetPermissionResolvers();
  registerPermissionResolver(({ principal, user }) => {
    if (user.provider !== "reference") {
      return [];
    }

    const personaRoles =
      principal.id === "reference-admin" ? (["user", "admin"] as const) : (["user"] as const);

    return referenceRolesToPermissions([...personaRoles]);
  });
});

describe("permission model", () => {
  it("uses centralized type-safe permission identifiers", () => {
    expect(permissions.users.read).toBe("users.read");
    expect(permissions.users.delete).toBe("users.delete");
  });

  it("resolves different permissions for reference-user vs reference-admin", () => {
    const userCtx = resolveAuthorizationContext(REFERENCE_USER);
    const adminCtx = resolveAuthorizationContext(REFERENCE_ADMIN);

    expect(hasPermission(userCtx, permissions.users.read)).toBe(true);
    expect(hasPermission(userCtx, permissions.users.delete)).toBe(false);
    expect(can(adminCtx, permissions.users.delete)).toBe(true);
  });

  it("derives principal id from OAuthUser", () => {
    const principal = principalFromUser(REFERENCE_USER);
    expect(principal.id).toBe("reference-user");
  });
});
