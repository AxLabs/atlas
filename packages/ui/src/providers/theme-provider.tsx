"use client";

import { useEffect } from "react";

import { initThemeStore } from "../hooks/use-theme";

import type React from "react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initThemeStore();
  }, []);

  return children;
}
