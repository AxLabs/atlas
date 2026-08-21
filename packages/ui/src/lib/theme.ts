export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme-preference";
export const DARK_THEME_CLASS = "dark";

/** Preference used when no stored value exists and for SSR before hydration. */
export const DEFAULT_THEME_PREFERENCE = "system" satisfies ThemePreference;

/** Resolved theme used for SSR and when system preference cannot be read. */
export const DEFAULT_RESOLVED_THEME = "light" satisfies ResolvedTheme;
