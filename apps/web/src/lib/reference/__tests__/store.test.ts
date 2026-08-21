import {
  createReferenceUser,
  getReferenceUsers,
  resetReferenceUsersStore,
} from "@/lib/reference/users/store";

describe("reference users store", () => {
  beforeEach(() => {
    resetReferenceUsersStore();
  });

  it("seeds deterministic users", () => {
    const users = getReferenceUsers();
    expect(users.map((user) => user.id)).toEqual([
      "reference-user",
      "reference-admin",
      "reference-user-extra",
    ]);
  });

  it("resets to seed state", () => {
    createReferenceUser({ email: "temp@atlas.local", name: "Temp User", role: "user" });
    expect(getReferenceUsers()).toHaveLength(4);

    resetReferenceUsersStore();
    expect(getReferenceUsers()).toHaveLength(3);
  });

  it("creates users with deterministic timestamps", () => {
    const user = createReferenceUser({
      email: "new@atlas.local",
      name: "New User",
      role: "user",
    });
    expect(user.createdAt).toBe("2024-02-01T12:00:00Z");
    expect(user.updatedAt).toBe("2024-02-01T12:00:00Z");
  });
});
