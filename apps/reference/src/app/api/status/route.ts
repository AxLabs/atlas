/**
 * Reference harness status endpoint.
 *
 * @module api/reference/status
 */

import { NextResponse } from "next/server";

import { getServerConfig } from "@/config/server";
import { listReferencePersonas } from "@/lib/reference/auth/personas";

import type { ReferenceUsersScenario } from "@/lib/reference/scenario";

const USERS_SCENARIOS: ReferenceUsersScenario[] = [
  "success",
  "empty",
  "validation",
  "unauthorized",
  "forbidden",
  "server-error",
  "slow",
  "offline",
];

export async function GET(): Promise<NextResponse> {
  const config = getServerConfig();

  if (!config.reference.enabled) {
    return NextResponse.json({ enabled: false });
  }

  return NextResponse.json({
    enabled: true,
    disclosure:
      "Reference mode is active. Sessions and API responses are deterministic fixtures — not production OAuth or backend evidence.",
    personas: listReferencePersonas().map((persona) => ({
      id: persona.principalId,
      email: persona.email,
      name: persona.name,
      roles: persona.roles,
    })),
    usersScenarios: USERS_SCENARIOS,
    apiBasePath: "/api",
  });
}
