import { permissions } from "@/lib/authz/permissions";
import { referenceRolesToPermissions } from "@/lib/reference/auth/permissions";

describe("reference role → permission adapter", () => {
  it("maps reference-user roles to read-only permissions", () => {
    expect(referenceRolesToPermissions(["user"])).toEqual([permissions.users.read]);
  });

  it("maps reference-admin roles to full user permissions", () => {
    expect(referenceRolesToPermissions(["user", "admin"])).toEqual([
      permissions.users.read,
      permissions.users.create,
      permissions.users.update,
      permissions.users.delete,
    ]);
  });

  it("produces materially different permissions for user vs admin", () => {
    const userPermissions = referenceRolesToPermissions(["user"]);
    const adminPermissions = referenceRolesToPermissions(["user", "admin"]);

    expect(userPermissions).toContain(permissions.users.read);
    expect(userPermissions).not.toContain(permissions.users.delete);
    expect(adminPermissions).toContain(permissions.users.delete);
    expect(adminPermissions.length).toBeGreaterThan(userPermissions.length);
  });
});
