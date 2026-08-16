import {
  DARK_THEME_CLASS,
  DEFAULT_RESOLVED_THEME,
  DEFAULT_THEME_PREFERENCE,
  type ResolvedTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "../lib/theme";

export type { ResolvedTheme, ThemePreference } from "../lib/theme";
export {
  DARK_THEME_CLASS,
  DEFAULT_RESOLVED_THEME,
  DEFAULT_THEME_PREFERENCE,
  THEME_STORAGE_KEY,
} from "../lib/theme";

export const STORAGE_KEY = THEME_STORAGE_KEY;

export interface ThemeState {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
}

const SERVER_SNAPSHOT: ThemeState = {
  preference: DEFAULT_THEME_PREFERENCE,
  resolvedTheme: DEFAULT_RESOLVED_THEME,
};

let state: ThemeState = { ...SERVER_SNAPSHOT };
let initialized = false;
const listeners = new Set<() => void>();
let cleanupListeners: (() => void) | null = null;

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeToTheme(listener: () => void): () => void {
  ensureInitialized();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getThemeSnapshot(): ThemeState {
  if (typeof window === "undefined") {
    return SERVER_SNAPSHOT;
  }

  ensureInitialized();
  return state;
}

export function getThemeServerSnapshot(): ThemeState {
  return SERVER_SNAPSHOT;
}

export function ensureInitialized(): void {
  if (initialized || typeof window === "undefined") {
    return;
  }

  initialized = true;
  syncFromStorage();
  setupListeners();
}

function setupListeners(): void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      syncFromStorage();
    }
  };

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleMediaChange = (event: MediaQueryListEvent) => {
    if (state.preference === "system") {
      const resolvedTheme = event.matches ? "dark" : "light";
      state = { ...state, resolvedTheme };
      applyResolvedThemeValue(resolvedTheme);
      notify();
    }
  };

  window.addEventListener("storage", handleStorage);
  mediaQuery.addEventListener("change", handleMediaChange);

  cleanupListeners = () => {
    window.removeEventListener("storage", handleStorage);
    mediaQuery.removeEventListener("change", handleMediaChange);
  };
}

function syncFromStorage(): void {
  const preference = readThemePreference();
  const resolvedTheme = resolveThemeValue(preference);
  state = { preference, resolvedTheme };
  applyResolvedThemeValue(resolvedTheme);
  notify();
}

export function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return DEFAULT_THEME_PREFERENCE;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage might be unavailable
  }

  return DEFAULT_THEME_PREFERENCE;
}

export function writeThemePreference(preference: ThemePreference): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

export function resolveThemeValue(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") {
    return preference;
  }

  if (typeof window === "undefined") {
    return DEFAULT_RESOLVED_THEME;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyResolvedThemeValue(theme: ResolvedTheme): void {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;

  if (theme === "dark") {
    root.classList.add(DARK_THEME_CLASS);
  } else {
    root.classList.remove(DARK_THEME_CLASS);
  }
}

export function updateThemePreference(preference: ThemePreference): void {
  if (typeof window === "undefined") {
    return;
  }

  writeThemePreference(preference);
  const resolvedTheme = resolveThemeValue(preference);
  state = { preference, resolvedTheme };
  applyResolvedThemeValue(resolvedTheme);
  notify();
}

/** @internal Reset store state between tests. */
export function resetThemeStoreForTests(): void {
  cleanupListeners?.();
  cleanupListeners = null;
  initialized = false;
  state = { ...SERVER_SNAPSHOT };
  listeners.clear();
}
