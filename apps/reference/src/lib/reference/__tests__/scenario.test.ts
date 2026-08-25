import {
  normalizeReferenceScenario,
  serializeReferenceScenario,
} from "@/lib/reference/scenario-types";
import { referenceScenario } from "@/test/helpers/reference";

describe("reference scenario", () => {
  it("normalizes valid scenario state", () => {
    expect(
      normalizeReferenceScenario({
        auth: "reference-user",
        users: "empty",
      })
    ).toEqual({
      auth: "reference-user",
      users: "empty",
    });
  });

  it("drops invalid values", () => {
    expect(
      normalizeReferenceScenario({
        auth: "invalid" as "reference-user",
        users: "invalid" as "success",
      })
    ).toEqual({});
  });

  it("serializes scenario for cookies/headers", () => {
    const payload = referenceScenario({ auth: "reference-admin", users: "slow" });
    expect(JSON.parse(serializeReferenceScenario(payload))).toEqual(payload);
  });
});
