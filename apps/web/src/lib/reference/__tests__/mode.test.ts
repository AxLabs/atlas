import {
  assertReferenceModeEnabled,
  isReferenceModeEnabled,
  isReferenceModeRequested,
  ReferenceModeForbiddenError,
} from "@/lib/reference/mode";

describe("reference mode", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      ATLAS_REFERENCE_MODE: "false",
      NEXT_PUBLIC_APP_ENV: "development",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("is disabled by default", () => {
    expect(isReferenceModeRequested()).toBe(false);
    expect(isReferenceModeEnabled()).toBe(false);
  });

  it("enables in non-production when explicitly requested", () => {
    process.env = {
      ...originalEnv,
      ATLAS_REFERENCE_MODE: "true",
      NEXT_PUBLIC_APP_ENV: "development",
    };
    expect(isReferenceModeEnabled()).toBe(true);
  });

  it("cannot enable when NODE_ENV is production", () => {
    process.env = {
      ...originalEnv,
      ATLAS_REFERENCE_MODE: "true",
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_ENV: "development",
    };
    expect(isReferenceModeEnabled()).toBe(false);
  });

  it("cannot enable when NEXT_PUBLIC_APP_ENV is production", () => {
    process.env.ATLAS_REFERENCE_MODE = "true";
    process.env.NEXT_PUBLIC_APP_ENV = "production";
    expect(isReferenceModeEnabled()).toBe(false);
  });

  it("throws ReferenceModeForbiddenError when requested in production app env", () => {
    process.env = {
      ...originalEnv,
      ATLAS_REFERENCE_MODE: "true",
      NEXT_PUBLIC_APP_ENV: "production",
    };

    expect(() => assertReferenceModeEnabled()).toThrow(ReferenceModeForbiddenError);
  });
});
