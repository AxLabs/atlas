/**
 * Reference users API — get, update, delete by ID.
 *
 * @module api/reference/users/[userId]
 */

import "@/lib/reference/auth/register";

import { NextResponse } from "next/server";

import { CORRELATION_ID_HEADER, generateCorrelationId } from "@/lib/api/correlation";
import { permissions } from "@/lib/authz/permissions";
import { authorizationErrorResponse, requirePermission } from "@/lib/authz/server";
import { assertReferenceModeEnabled } from "@/lib/reference/mode";
import { resolveUsersScenario } from "@/lib/reference/scenario";
import {
  handleDeleteUserScenario,
  handleGetUserScenario,
  handleUpdateUserScenario,
} from "@/lib/reference/users/scenarios";

import type { components } from "@/lib/api/contracts";
import type { NextRequest } from "next/server";

type ApiError = components["schemas"]["ApiError"];

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
): Promise<NextResponse> {
  const { userId } = await context.params;

  try {
    assertReferenceModeEnabled();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reference mode unavailable";
    return NextResponse.json({ code: "REFERENCE_MODE_DISABLED", message }, { status: 403 });
  }

  const correlationId = request.headers.get(CORRELATION_ID_HEADER) ?? generateCorrelationId();
  const scenario = await resolveUsersScenario(request);

  try {
    await requirePermission(permissions.users.read, {
      resourceType: "users",
      resourceId: userId,
      correlationId,
    });
  } catch (error) {
    const response = authorizationErrorResponse(error, correlationId);
    if (response) {
      return response;
    }
    throw error;
  }

  return handleGetUserScenario(userId, { correlationId, scenario });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
): Promise<NextResponse> {
  const { userId } = await context.params;

  try {
    assertReferenceModeEnabled();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reference mode unavailable";
    return NextResponse.json({ code: "REFERENCE_MODE_DISABLED", message }, { status: 403 });
  }

  const correlationId = request.headers.get(CORRELATION_ID_HEADER) ?? generateCorrelationId();
  const scenario = await resolveUsersScenario(request);

  try {
    await requirePermission(permissions.users.update, {
      resourceType: "users",
      resourceId: userId,
      correlationId,
    });
  } catch (error) {
    const response = authorizationErrorResponse(error, correlationId);
    if (response) {
      return response;
    }
    throw error;
  }

  try {
    const body = (await request.json()) as components["schemas"]["UpdateUserRequest"];
    return handleUpdateUserScenario(userId, body, { correlationId, scenario });
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

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
): Promise<NextResponse> {
  const { userId } = await context.params;

  try {
    assertReferenceModeEnabled();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reference mode unavailable";
    return NextResponse.json({ code: "REFERENCE_MODE_DISABLED", message }, { status: 403 });
  }

  const correlationId = request.headers.get(CORRELATION_ID_HEADER) ?? generateCorrelationId();
  const scenario = await resolveUsersScenario(request);

  try {
    await requirePermission(permissions.users.delete, {
      resourceType: "users",
      resourceId: userId,
      correlationId,
    });
  } catch (error) {
    const response = authorizationErrorResponse(error, correlationId);
    if (response) {
      return response;
    }
    throw error;
  }

  return handleDeleteUserScenario(userId, { correlationId, scenario });
}
