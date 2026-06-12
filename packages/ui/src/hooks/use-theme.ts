"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  applyResolvedThemeValue,
  ensureInitialized,
  getThemeServerSnapshot,
  getThemeSnapshot,
  readThemePreference,
  type ResolvedTheme,
  resolveThemeValue,
  subscribeToTheme,
  type ThemePreference,
  updateThemePreference,
} from "../theme/theme-store";

export type { ResolvedTheme, ThemePreference } from "../theme/theme-store";

/**
 * Get theme preference from localStorage
 */
export function getThemePreference(): ThemePreference {
  return readThemePreference();
}

/**
 * Set theme preference in localStorage and notify all subscribers
 */
export function setThemePreference(preference: ThemePreference): void {
  if (typeof window === "undefined") {
    return;
  }

  updateThemePreference(preference);
}

/**
 * Resolve theme preference to actual theme
 */
export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return resolveThemeValue(preference);
}

/**
 * Apply resolved theme to document
 */
export function applyResolvedTheme(theme: ResolvedTheme): void {
  applyResolvedThemeValue(theme);
}

/**
 * React hook for theme management
 */
export function useTheme() {
  const { preference, resolvedTheme } = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getThemeServerSnapshot
  );

  const setPreference = useCallback((newPreference: ThemePreference) => {
    updateThemePreference(newPreference);
  }, []);

  const toggle = useCallback(() => {
    const newPreference = resolvedTheme === "dark" ? "light" : "dark";
    updateThemePreference(newPreference);
  }, [resolvedTheme]);

  const setSystem = useCallback(() => {
    updateThemePreference("system");
  }, []);

  return {
    preference,
    resolvedTheme,
    setPreference,
    toggle,
    setSystem,
  };
}

export { ensureInitialized as initThemeStore };
