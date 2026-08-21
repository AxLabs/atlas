/**
 * Deterministic seed data for reference users API.
 *
 * @module lib/reference/users/seed
 */

import { REFERENCE_PERSONA_IDS } from "../auth/personas";

import type { components } from "@/lib/api/contracts";

type User = components["schemas"]["User"];

/** Fixed timestamps for deterministic responses. */
export const REFERENCE_USER_TIMESTAMPS = {
  userCreated: "2024-01-15T10:30:00Z",
  userUpdated: "2024-01-15T10:30:00Z",
  adminCreated: "2024-01-10T08:00:00Z",
  adminUpdated: "2024-01-12T09:15:00Z",
  extraCreated: "2024-01-16T14:20:00Z",
  extraUpdated: "2024-01-16T14:20:00Z",
} as const;

export function createReferenceUserSeed(): User[] {
  return [
    {
      id: REFERENCE_PERSONA_IDS.user,
      email: "reference.user@atlas.local",
      name: "Reference User",
      avatarUrl: null,
      role: "user",
      createdAt: REFERENCE_USER_TIMESTAMPS.userCreated,
      updatedAt: REFERENCE_USER_TIMESTAMPS.userUpdated,
    },
    {
      id: REFERENCE_PERSONA_IDS.admin,
      email: "reference.admin@atlas.local",
      name: "Reference Admin",
      avatarUrl: null,
      role: "admin",
      createdAt: REFERENCE_USER_TIMESTAMPS.adminCreated,
      updatedAt: REFERENCE_USER_TIMESTAMPS.adminUpdated,
    },
    {
      id: "reference-user-extra",
      email: "extra.user@atlas.local",
      name: "Extra Reference User",
      avatarUrl: null,
      role: "user",
      createdAt: REFERENCE_USER_TIMESTAMPS.extraCreated,
      updatedAt: REFERENCE_USER_TIMESTAMPS.extraUpdated,
    },
  ];
}
