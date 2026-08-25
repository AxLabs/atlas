import {
  assertReferenceModeEnabled,
  isReferenceModeEnabled,
  isReferenceModeRequested,
  ReferenceModeForbiddenError,
} from "@/config/reference";

describe("reference mode", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_ENV: "development",
      NODE_ENV: "development",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("is enabled in development for the reference application", () => {
    expect(isReferenceModeEnabled()).toBe(true);
  });

  it("cannot enable when NODE_ENV is production", () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_ENV: "development",
    };
    expect(isReferenceModeEnabled()).toBe(false);
  });

  it("cannot enable when NEXT_PUBLIC_APP_ENV is production", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "production";
    expect(isReferenceModeEnabled()).toBe(false);
  });

  it("throws ReferenceModeForbiddenError when adapters are unavailable in production", () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_ENV: "production",
    };

    expect(() => assertReferenceModeEnabled()).toThrow(ReferenceModeForbiddenError);
  });

  it("treats explicit ATLAS_REFERENCE_MODE=false as a request flag only", () => {
    process.env.ATLAS_REFERENCE_MODE = "false";
    expect(isReferenceModeRequested()).toBe(false);
    expect(isReferenceModeEnabled()).toBe(true);
  });
});
