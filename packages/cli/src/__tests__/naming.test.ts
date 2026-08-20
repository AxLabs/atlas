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
    expect(routeToPageTitle("settings/profile")).toBe("Settings — Profile");
    expect(routeToPageComponentName("settings/profile")).toBe("SettingsProfilePage");
  });

  it("rejects unsafe feature names", () => {
    expect(() => validateKebabCaseName("../users", "Feature name")).toThrow(
      expect.objectContaining({ code: CliErrorCode.USAGE_ERROR, exitCode: ExitCode.USAGE_ERROR })
    );
  });
});
