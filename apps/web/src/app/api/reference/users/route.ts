/**
 * Reference users API — list and create.
 *
 * @module api/reference/users
 */

import { NextResponse } from "next/server";

import { CORRELATION_ID_HEADER, generateCorrelationId } from "@/lib/api/correlation";
import { assertReferenceModeEnabled } from "@/lib/reference/mode";
import { resolveUsersScenario } from "@/lib/reference/scenario";
import { handleCreateUserScenario, handleListUsersScenario } from "@/lib/reference/users/scenarios";

import type { components } from "@/lib/api/contracts";
import type { NextRequest } from "next/server";

type ApiError = components["schemas"]["ApiError"];

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    assertReferenceModeEnabled();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reference mode unavailable";
    return NextResponse.json({ code: "REFERENCE_MODE_DISABLED", message }, { status: 403 });
  }

  const correlationId = request.headers.get(CORRELATION_ID_HEADER) ?? generateCorrelationId();
  const scenario = await resolveUsersScenario(request);

  return handleListUsersScenario(request, { correlationId, scenario });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    assertReferenceModeEnabled();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reference mode unavailable";
    return NextResponse.json({ code: "REFERENCE_MODE_DISABLED", message }, { status: 403 });
  }

  const correlationId = request.headers.get(CORRELATION_ID_HEADER) ?? generateCorrelationId();
  const scenario = await resolveUsersScenario(request);

  try {
    const body = (await request.json()) as components["schemas"]["CreateUserRequest"];
    return handleCreateUserScenario(body, { correlationId, scenario });
  } catch {
    return NextResponse.json<ApiError>(
      {
        code: "INVALID_JSON",
        message: "Failed to parse request body",
        userMessage: "Invalid request format.",
        correlationId,
      },
      { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
    );
  }
}
