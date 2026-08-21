/**
 * Deterministic reference auth personas.
 *
 * Stable fixture identities for local development and automated tests.
 * Reference persona metadata provides deterministic profiles for #41 to map
 * into the eventual authorization model.
 *
 * @module lib/reference/auth/personas
 */

import type { ReferenceAuthPersona } from "../scenario-types";
import type { OAuthUser } from "@/lib/auth/types";

export interface ReferencePersona extends OAuthUser {
  principalId: string;
  /** Reference-only profile metadata — not part of the core auth contract. */
  roles: string[];
}

/** Strip reference-only metadata before persisting to the standard session contract. */
export function referencePersonaToSessionUser(persona: ReferencePersona): OAuthUser {
  return {
    provider: persona.provider,
    providerAccountId: persona.providerAccountId,
    principalId: persona.principalId,
    email: persona.email,
    name: persona.name,
    avatarUrl: persona.avatarUrl,
  };
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
