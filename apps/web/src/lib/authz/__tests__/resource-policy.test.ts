import { canOnResource, registerResourcePolicy, resetResourcePolicy } from "@/lib/authz/policy";
import { permissions } from "@/lib/authz/permissions";
import { resolveAuthorizationContext } from "@/lib/authz/context";
import { resetPermissionResolvers } from "@/lib/authz/resolvers";
import { ensureAuthzSetup, resetAuthzSetup } from "@/lib/authz/setup";

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

describe("canOnResource", () => {
  beforeEach(() => {
    resetPermissionResolvers();
    resetResourcePolicy();
    resetAuthzSetup();
    ensureAuthzSetup();
  });

  it("returns false when global permission is missing even if policy allows", async () => {
    registerResourcePolicy(() => true);
    const ctx = resolveAuthorizationContext(REFERENCE_USER);

    await expect(canOnResource(ctx, permissions.users.delete, "users", "any-user")).resolves.toBe(
      false
    );
  });

  it("returns true when global permission is present and no policy is registered", async () => {
    const ctx = resolveAuthorizationContext(REFERENCE_ADMIN);

    await expect(
      canOnResource(ctx, permissions.users.update, "users", "reference-user")
    ).resolves.toBe(true);
  });

  it("returns true when global permission and resource policy allow", async () => {
    registerResourcePolicy(() => true);
    const ctx = resolveAuthorizationContext(REFERENCE_ADMIN);

    await expect(
      canOnResource(ctx, permissions.users.update, "users", "reference-user")
    ).resolves.toBe(true);
  });

  it("returns false when global permission is present but resource policy denies", async () => {
    registerResourcePolicy(() => false);
    const ctx = resolveAuthorizationContext(REFERENCE_ADMIN);

    await expect(
      canOnResource(ctx, permissions.users.update, "users", "reference-admin")
    ).resolves.toBe(false);
  });
});
