"use client";

import { Toaster } from "@atlas/ui";
import { useEffect, useState } from "react";

import { registerToasterMount } from "@/lib/notifications/toaster-host";

import type React from "react";

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    registerToasterMount(() => setMounted(true));
    return () => registerToasterMount(null);
  }, []);

  return (
    <>
      {children}
      {mounted && <Toaster />}
    </>
  );
}
