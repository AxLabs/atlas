"use client";

import { useEffect, useState } from "react";

import { hasConsentForCategory } from "./utils";

import type { ConsentCategory } from "./types";
import type React from "react";

export interface ConsentGateProps {
  category: ConsentCategory;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Renders children only when the given consent category is granted.
 */
export function ConsentGate({ category, children, fallback = null }: ConsentGateProps) {
  const [granted, setGranted] = useState(() => hasConsentForCategory(category));

  useEffect(() => {
    const update = () => {
      setGranted(hasConsentForCategory(category));
    };

    update();
    window.addEventListener("cc:onConsent", update);
    window.addEventListener("cc:onChange", update);

    return () => {
      window.removeEventListener("cc:onConsent", update);
      window.removeEventListener("cc:onChange", update);
    };
  }, [category]);

  if (!granted) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
