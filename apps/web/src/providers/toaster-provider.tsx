"use client";

import type React from "react";
import { Toaster } from "sonner";

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster position="top-right" />
    </>
  );
}
