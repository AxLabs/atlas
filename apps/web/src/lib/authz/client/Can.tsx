"use client";

/**
 * Presentation-only permission gate.
 *
 * **Client-side authorization controls presentation only. It is not a security boundary.**
 * Protected routes, API handlers, and mutations must enforce permissions on the server.
 *
 * @module lib/authz/client/Can
 */

import { usePermission } from "./usePermission";

import type { Permission } from "../permissions";
import type { ReactNode } from "react";

export interface CanProps {
  permission: Permission;
  children: ReactNode;
  /** Rendered when permission is denied (default: nothing). */
  fallback?: ReactNode;
}

/**
 * Renders children when the current session grants the permission.
 */
export function Can({ permission, children, fallback = null }: CanProps) {
  const allowed = usePermission(permission);

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
