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

  it("isolates mutations across store ids", () => {
    resetReferenceUsersStore("store-a");
    resetReferenceUsersStore("store-b");

    createReferenceUser({ email: "temp@atlas.local", name: "Temp User", role: "user" }, "store-a");

    expect(getReferenceUsers("store-a")).toHaveLength(4);
    expect(getReferenceUsers("store-b")).toHaveLength(3);

    resetReferenceUsersStore("store-a");
    expect(getReferenceUsers("store-a")).toHaveLength(3);
    expect(getReferenceUsers("store-b")).toHaveLength(3);
  });

  it("lazy-allocates the canonical seed for a never-seen store id", () => {
    expect(getReferenceUsers("never-seen-scope").map((user) => user.id)).toEqual([
      "reference-user",
      "reference-admin",
      "reference-user-extra",
    ]);
  });

  it("reset of one store leaves another store's mutations intact", () => {
    createReferenceUser(
      { email: "keep@atlas.local", name: "Keep User", role: "user" },
      "store-keep"
    );
    createReferenceUser(
      { email: "drop@atlas.local", name: "Drop User", role: "user" },
      "store-drop"
    );

    resetReferenceUsersStore("store-drop");

    expect(getReferenceUsers("store-keep").map((user) => user.email)).toContain("keep@atlas.local");
    expect(getReferenceUsers("store-drop").map((user) => user.email)).not.toContain(
      "drop@atlas.local"
    );
    expect(getReferenceUsers("store-drop")).toHaveLength(3);
  });
});
