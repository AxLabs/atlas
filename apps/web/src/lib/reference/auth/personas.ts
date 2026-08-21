/**
 * Deterministic reference auth personas.
 *
 * Stable fixture identities for local development and automated tests.
 * Permission profiles for #41 can extend roles without replacing personas.
 *
 * @module lib/reference/auth/personas
 */

import type { ReferenceAuthPersona } from "../scenario-types";
import type { OAuthUser } from "@/lib/auth/types";

export interface ReferencePersona extends OAuthUser {
  principalId: string;
  roles: string[];
}

export const REFERENCE_PERSONA_IDS = {
  user: "reference-user",
  admin: "reference-admin",
} as const;

const REFERENCE_USER: ReferencePersona = {
  provider: "reference",
  providerAccountId: REFERENCE_PERSONA_IDS.user,
  principalId: REFERENCE_PERSONA_IDS.user,
  email: "reference.user@atlas.local",
  name: "Reference User",
  avatarUrl: null,
  roles: ["user"],
};

const REFERENCE_ADMIN: ReferencePersona = {
  provider: "reference",
  providerAccountId: REFERENCE_PERSONA_IDS.admin,
  principalId: REFERENCE_PERSONA_IDS.admin,
  email: "reference.admin@atlas.local",
  name: "Reference Admin",
  avatarUrl: null,
  roles: ["user", "admin"],
};

export const REFERENCE_PERSONAS: Record<
  Exclude<ReferenceAuthPersona, "anonymous">,
  ReferencePersona
> = {
  "reference-user": REFERENCE_USER,
  "reference-admin": REFERENCE_ADMIN,
};

export function getReferencePersona(persona: ReferenceAuthPersona): ReferencePersona | null {
  if (persona === "anonymous") {
    return null;
  }

  return REFERENCE_PERSONAS[persona];
}

export function listReferencePersonas(): ReferencePersona[] {
  return Object.values(REFERENCE_PERSONAS);
}
