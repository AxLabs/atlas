"use client";

import { createContext, useContext } from "react";

import { env } from "@/env/public-env";

import type React from "react";

type Env = typeof env;

const EnvContext = createContext<Env | undefined>(undefined);

export function EnvProvider({ children }: { children: React.ReactNode }) {
  return <EnvContext.Provider value={env}>{children}</EnvContext.Provider>;
}

export function useEnv() {
  const context = useContext(EnvContext);
  if (context === undefined) {
    throw new Error("useEnv must be used within EnvProvider");
  }
  return context;
}
