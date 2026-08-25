import { buildReferenceSessionData } from "@/lib/reference/auth/session-builder";
import { getReferencePersona, REFERENCE_PERSONA_IDS } from "@/lib/reference/auth/personas";

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
      },
      accessToken: "reference-access-token-reference-user",
      accessTokenExpiresAt: 4_102_444_800,
      createdAt: 1_700_000_000,
      expiresAt: 4_102_444_800,
    });
  });

  it("builds deterministic session data for reference-admin", () => {
    const session = buildReferenceSessionData("reference-admin");
    expect(session?.user.principalId).toBe(REFERENCE_PERSONA_IDS.admin);
    expect(getReferencePersona("reference-admin")?.roles).toEqual(["user", "admin"]);
  });

  it("does not persist reference-only roles on the session user contract", () => {
    const session = buildReferenceSessionData("reference-user");
    expect(session?.user).not.toHaveProperty("roles");
  });

  it("produces identical sessions on repeated calls", () => {
    const first = buildReferenceSessionData("reference-user");
    const second = buildReferenceSessionData("reference-user");
    expect(first).toEqual(second);
  });
});
