"use client";

import { createContext, useContext } from "react";

import { useConfig } from "@/config";

import type { ClientConfig } from "@/config";
import type React from "react";

/**
 * Legacy EnvProvider - wraps config facade for backwards compatibility.
 *
 * @deprecated Use useConfig() from '@/config' directly instead.
 */

const EnvContext = createContext<ClientConfig | undefined>(undefined);

export function EnvProvider({ children }: { children: React.ReactNode }) {
  const config = useConfig();
  return <EnvContext.Provider value={config}>{children}</EnvContext.Provider>;
}

/**
 * @deprecated Use useConfig() from '@/config' instead.
 */
export function useEnv() {
  const context = useContext(EnvContext);
  if (context === undefined) {
    throw new Error("useEnv must be used within EnvProvider");
  }
  return context;
}
