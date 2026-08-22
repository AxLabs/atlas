/**
 * Reference auth session control — select deterministic persona.
 *
 * @module api/reference/auth/session
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getServerConfig } from "@/config/server";
import { createSessionCookie, destroySessionCookie } from "@/lib/auth/session";
import { buildReferenceSessionData } from "@/lib/reference/auth/session-builder";
import { assertReferenceModeEnabled } from "@/lib/reference/mode";
import {
  normalizeReferenceScenario,
  REFERENCE_SCENARIO_COOKIE,
  serializeReferenceScenario,
} from "@/lib/reference/scenario";

import type { ReferenceAuthPersona, ReferenceScenarioState } from "@/lib/reference/scenario";
import type { NextRequest } from "next/server";

interface SessionRequestBody {
  persona?: ReferenceAuthPersona;
  scenario?: ReferenceScenarioState;
}

function isProductionAppEnv(): boolean {
  return getServerConfig().app.env === "production";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    assertReferenceModeEnabled();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reference mode unavailable";
    return NextResponse.json({ code: "REFERENCE_MODE_DISABLED", message }, { status: 403 });
  }

  const body = (await request.json()) as SessionRequestBody;
  const persona = body.persona ?? "anonymous";
  const scenario = normalizeReferenceScenario(body.scenario ?? {});

  if (persona === "anonymous") {
    await destroySessionCookie();
  } else {
    const sessionData = buildReferenceSessionData(persona);
    if (!sessionData) {
      return NextResponse.json(
        { code: "INVALID_PERSONA", message: `Unknown persona: ${persona}` },
        { status: 400 }
      );
    }
    await createSessionCookie(sessionData);
  }

  const cookieStore = await cookies();
  const scenarioState: ReferenceScenarioState = {
    ...scenario,
    auth: persona,
  };

  cookieStore.set(REFERENCE_SCENARIO_COOKIE, serializeReferenceScenario(scenarioState), {
    httpOnly: true,
    secure: isProductionAppEnv(),
    sameSite: "lax",
    path: "/",
    maxAge: 86400,
  });

  return NextResponse.json({
    persona,
    scenario: scenarioState,
    referenceMode: true,
    disclosure: "Reference session — not evidence of production OAuth security.",
  });
}
