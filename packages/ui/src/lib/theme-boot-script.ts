import { DARK_THEME_CLASS, DEFAULT_THEME_PREFERENCE, THEME_STORAGE_KEY } from "./theme";

/**
 * Inline theme boot script for server layouts.
 * Keeps storage key, defaults, and dark-class handling aligned with the theme store.
 */
export function getThemeBootScriptContent(): string {
  const storageKey = JSON.stringify(THEME_STORAGE_KEY);
  const defaultPreference = JSON.stringify(DEFAULT_THEME_PREFERENCE);
  const darkClass = JSON.stringify(DARK_THEME_CLASS);

  return `(function() {
  try {
    const key = ${storageKey};
    const stored = localStorage.getItem(key);
    const preference = (stored === "light" || stored === "dark" || stored === "system") ? stored : ${defaultPreference};

    let theme = preference;
    if (preference === "system") {
      theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    if (theme === "dark") {
      document.documentElement.classList.add(${darkClass});
    } else {
      document.documentElement.classList.remove(${darkClass});
    }
  } catch (e) {
    // localStorage might be unavailable
  }
})();`;
}
