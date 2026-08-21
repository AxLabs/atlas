import { buildReferenceSessionData } from "@/lib/reference/auth/session-builder";
import { REFERENCE_PERSONA_IDS } from "@/lib/reference/auth/personas";

describe("buildReferenceSessionData", () => {
  it("returns null for anonymous persona", () => {
    expect(buildReferenceSessionData("anonymous")).toBeNull();
  });

  it("builds deterministic session data for reference-user", () => {
    const session = buildReferenceSessionData("reference-user");
    expect(session).toMatchObject({
      user: {
        provider: "reference",
        principalId: REFERENCE_PERSONA_IDS.user,
        email: "reference.user@atlas.local",
        roles: ["user"],
      },
      accessToken: "reference-access-token-reference-user",
      accessTokenExpiresAt: 4_102_444_800,
      createdAt: 1_700_000_000,
    });
  });

  it("builds deterministic session data for reference-admin with elevated roles", () => {
    const session = buildReferenceSessionData("reference-admin");
    expect(session?.user.roles).toEqual(["user", "admin"]);
    expect(session?.user.principalId).toBe(REFERENCE_PERSONA_IDS.admin);
  });

  it("produces identical sessions on repeated calls", () => {
    const first = buildReferenceSessionData("reference-user");
    const second = buildReferenceSessionData("reference-user");
    expect(first).toEqual(second);
  });
});
