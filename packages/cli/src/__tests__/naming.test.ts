import { CliErrorCode } from "../errors/cli-error";
import { ExitCode } from "../exit-codes";
import {
  kebabToCamel,
  kebabToPascal,
  parseFeatureName,
  routeToPageComponentName,
  routeToPageTitle,
  validateAppRouterRoute,
  validateKebabCaseName,
} from "../generators/naming";

describe("generator naming", () => {
  it("derives deterministic identifier stems", () => {
    expect(parseFeatureName("billing-history")).toEqual({
      kebab: "billing-history",
      camel: "billingHistory",
      pascal: "BillingHistory",
    });
    expect(kebabToCamel("users")).toBe("users");
    expect(kebabToPascal("users")).toBe("Users");
  });

  it("validates routes and titles", () => {
    expect(validateAppRouterRoute("settings/profile")).toBe("settings/profile");
    expect(validateAppRouterRoute("users/[id]")).toBe("users/[id]");
    expect(validateAppRouterRoute("users/[userId]")).toBe("users/[userId]");
    expect(routeToPageTitle("settings/profile")).toBe("Settings — Profile");
    expect(routeToPageComponentName("settings/profile")).toBe("SettingsProfilePage");
    expect(routeToPageComponentName("users/[id]")).toBe("UsersIdPage");
  });

  it("rejects invalid dynamic route segments", () => {
    for (const route of ["users/[123]", "users/[user-id]", "users/[../id]"]) {
      expect(() => validateAppRouterRoute(route)).toThrow(
        expect.objectContaining({ code: CliErrorCode.USAGE_ERROR, exitCode: ExitCode.USAGE_ERROR })
      );
    }
  });

  it("rejects unsafe feature names", () => {
    expect(() => validateKebabCaseName("../users", "Feature name")).toThrow(
      expect.objectContaining({ code: CliErrorCode.USAGE_ERROR, exitCode: ExitCode.USAGE_ERROR })
    );
  });
});
