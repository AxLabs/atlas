import {
  DARK_THEME_CLASS,
  DEFAULT_RESOLVED_THEME,
  DEFAULT_THEME_PREFERENCE,
  THEME_STORAGE_KEY,
} from "../theme";
import { getThemeBootScriptContent } from "../theme-boot-script";
import { getThemeServerSnapshot, STORAGE_KEY } from "../../theme/theme-store";

describe("theme constants", () => {
  it("exports server-safe defaults aligned with the theme store snapshot", () => {
    const snapshot = getThemeServerSnapshot();

    expect(THEME_STORAGE_KEY).toBe(STORAGE_KEY);
    expect(DEFAULT_THEME_PREFERENCE).toBe("system");
    expect(DEFAULT_RESOLVED_THEME).toBe("light");
    expect(snapshot.preference).toBe(DEFAULT_THEME_PREFERENCE);
    expect(snapshot.resolvedTheme).toBe(DEFAULT_RESOLVED_THEME);
  });
});

describe("getThemeBootScriptContent", () => {
  it("inlines storage key, defaults, and dark class from shared constants", () => {
    const script = getThemeBootScriptContent();

    expect(script).toContain(JSON.stringify(THEME_STORAGE_KEY));
    expect(script).toContain(JSON.stringify(DEFAULT_THEME_PREFERENCE));
    expect(script).toContain(JSON.stringify(DARK_THEME_CLASS));
    expect(script).toContain('stored === "light" || stored === "dark" || stored === "system"');
    expect(script).toContain('window.matchMedia("(prefers-color-scheme: dark)")');
    expect(script).toContain(`classList.add(${JSON.stringify(DARK_THEME_CLASS)})`);
    expect(script).toContain(`classList.remove(${JSON.stringify(DARK_THEME_CLASS)})`);
  });

  it("uses shared constants for boot script defaults", () => {
    const script = getThemeBootScriptContent();

    expect(script).toContain(`const key = ${JSON.stringify(THEME_STORAGE_KEY)}`);
    expect(script).toContain(`? stored : ${JSON.stringify(DEFAULT_THEME_PREFERENCE)}`);
    expect(script).toContain(`classList.add(${JSON.stringify(DARK_THEME_CLASS)})`);
    expect(script).toContain(`classList.remove(${JSON.stringify(DARK_THEME_CLASS)})`);
  });
});
