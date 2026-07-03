import { getServerEnvSchema } from "./validate-server-env";

describe("getServerEnvSchema", () => {
  it("allows missing DATABASE_URL in development", () => {
    const schema = getServerEnvSchema("development");

    expect(
      schema.parse({
        NODE_ENV: "development",
      })
    ).toEqual({
      NODE_ENV: "development",
      LOG_LEVEL: "info",
      AUTH_SESSION_TTL_SECONDS: 604800,
    });
  });

  it("requires DATABASE_URL in production", () => {
    const schema = getServerEnvSchema("production");

    expect(() =>
      schema.parse({
        NODE_ENV: "production",
      })
    ).toThrow(/DATABASE_URL/);
  });

  it("accepts DATABASE_URL in production when valid", () => {
    const schema = getServerEnvSchema("production");

    expect(
      schema.parse({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:password@localhost:5432/atlas_ci",
      })
    ).toMatchObject({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:password@localhost:5432/atlas_ci",
    });
  });
});
