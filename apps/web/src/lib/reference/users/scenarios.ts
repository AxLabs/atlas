/**
 * Scenario handlers for reference users API.
 *
 * @module lib/reference/users/scenarios
 */

import "server-only";

import { NextResponse } from "next/server";

import { CORRELATION_ID_HEADER } from "@/lib/api/correlation";

import {
  createReferenceUser,
  deleteReferenceUser,
  getReferenceUser,
  getReferenceUsers,
  updateReferenceUser,
} from "./store";

import type { ReferenceUsersScenario } from "../scenario-types";
import type { components } from "@/lib/api/contracts";
import type { NextRequest } from "next/server";

type User = components["schemas"]["User"];
type UserListResponse = components["schemas"]["UserListResponse"];
type CreateUserRequest = components["schemas"]["CreateUserRequest"];
type UpdateUserRequest = components["schemas"]["UpdateUserRequest"];
type ApiError = components["schemas"]["ApiError"];

const SLOW_DELAY_MS = 1500;

interface ScenarioContext {
  correlationId: string;
  scenario: ReferenceUsersScenario;
}

function errorResponse(status: number, error: ApiError): NextResponse<ApiError> {
  return NextResponse.json(error, {
    status,
    headers: { [CORRELATION_ID_HEADER]: error.correlationId ?? "unknown" },
  });
}

function jsonWithCorrelation<T>(data: T, status: number, correlationId: string): NextResponse<T> {
  return NextResponse.json(data, {
    status,
    headers: { [CORRELATION_ID_HEADER]: correlationId },
  });
}

async function applyScenarioDelay(scenario: ReferenceUsersScenario): Promise<void> {
  if (scenario === "slow") {
    await new Promise((resolve) => setTimeout(resolve, SLOW_DELAY_MS));
  }
}

export async function handleListUsersScenario(
  request: NextRequest,
  context: ScenarioContext
): Promise<NextResponse<UserListResponse | ApiError>> {
  const { correlationId, scenario } = context;

  await applyScenarioDelay(scenario);

  switch (scenario) {
    case "unauthorized":
      return errorResponse(401, {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        userMessage: "Please log in to continue.",
        correlationId,
      });

    case "forbidden":
      return errorResponse(403, {
        code: "FORBIDDEN",
        message: "Insufficient permissions",
        userMessage: "You don't have permission to view users.",
        correlationId,
      });

    case "server-error":
      return errorResponse(500, {
        code: "INTERNAL_ERROR",
        message: "Simulated server error",
        userMessage: "Something went wrong. Please try again later.",
        correlationId,
      });

    case "offline":
      return errorResponse(503, {
        code: "SERVICE_UNAVAILABLE",
        message: "Simulated offline/network failure",
        userMessage: "Unable to connect. Please check your network connection.",
        correlationId,
      });

    case "empty":
      return jsonWithCorrelation<UserListResponse>(
        {
          data: [],
          pagination: {
            page: 1,
            pageSize: 20,
            total: 0,
            totalPages: 0,
          },
        },
        200,
        correlationId
      );

    case "validation":
      return errorResponse(422, {
        code: "VALIDATION_ERROR",
        message: "Simulated validation failure on list",
        userMessage: "Invalid request parameters.",
        correlationId,
        details: {
          fields: {
            page: ["Page must be a positive integer"],
          },
        },
      });

    case "success":
    case "slow":
    default: {
      const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
      const pageSize = Number(request.nextUrl.searchParams.get("pageSize") ?? "20");
      const data = getReferenceUsers();

      return jsonWithCorrelation<UserListResponse>(
        {
          data,
          pagination: {
            page,
            pageSize,
            total: data.length,
            totalPages: Math.max(1, Math.ceil(data.length / pageSize)),
          },
        },
        200,
        correlationId
      );
    }
  }
}

export async function handleGetUserScenario(
  userId: string,
  context: ScenarioContext
): Promise<NextResponse<User | ApiError>> {
  const { correlationId, scenario } = context;

  await applyScenarioDelay(scenario);

  if (scenario === "unauthorized") {
    return errorResponse(401, {
      code: "UNAUTHORIZED",
      message: "Authentication required",
      userMessage: "Please log in to continue.",
      correlationId,
    });
  }

  if (scenario === "forbidden") {
    return errorResponse(403, {
      code: "FORBIDDEN",
      message: "Insufficient permissions",
      userMessage: "You don't have permission to view this user.",
      correlationId,
    });
  }

  if (scenario === "server-error" || scenario === "offline") {
    return errorResponse(scenario === "offline" ? 503 : 500, {
      code: scenario === "offline" ? "SERVICE_UNAVAILABLE" : "INTERNAL_ERROR",
      message: "Simulated failure",
      userMessage: "Something went wrong. Please try again later.",
      correlationId,
    });
  }

  const user = getReferenceUser(userId);
  if (!user) {
    return errorResponse(404, {
      code: "NOT_FOUND",
      message: "User not found",
      userMessage: "The requested user could not be found.",
      correlationId,
    });
  }

  return jsonWithCorrelation(user, 200, correlationId);
}

export async function handleCreateUserScenario(
  body: CreateUserRequest,
  context: ScenarioContext
): Promise<NextResponse<User | ApiError>> {
  const { correlationId, scenario } = context;

  await applyScenarioDelay(scenario);

  if (scenario === "validation") {
    return errorResponse(422, {
      code: "VALIDATION_ERROR",
      message: "Simulated validation failure",
      userMessage: "Please check your input and try again.",
      correlationId,
      details: {
        fields: {
          email: ["Email is invalid"],
          name: ["Name is required"],
        },
      },
    });
  }

  if (scenario === "unauthorized") {
    return errorResponse(401, {
      code: "UNAUTHORIZED",
      message: "Authentication required",
      userMessage: "Please log in to continue.",
      correlationId,
    });
  }

  if (scenario === "server-error" || scenario === "offline") {
    return errorResponse(scenario === "offline" ? 503 : 500, {
      code: scenario === "offline" ? "SERVICE_UNAVAILABLE" : "INTERNAL_ERROR",
      message: "Simulated mutation failure",
      userMessage: "Something went wrong. Please try again later.",
      correlationId,
    });
  }

  const user = createReferenceUser(body);
  return jsonWithCorrelation(user, 201, correlationId);
}

export async function handleUpdateUserScenario(
  userId: string,
  body: UpdateUserRequest,
  context: ScenarioContext
): Promise<NextResponse<User | ApiError>> {
  const { correlationId, scenario } = context;

  await applyScenarioDelay(scenario);

  if (scenario === "validation") {
    return errorResponse(422, {
      code: "VALIDATION_ERROR",
      message: "Simulated validation failure",
      userMessage: "Please check your input and try again.",
      correlationId,
      details: {
        fields: {
          name: ["Name must be at least 1 character"],
        },
      },
    });
  }

  if (scenario === "server-error" || scenario === "offline") {
    return errorResponse(scenario === "offline" ? 503 : 500, {
      code: scenario === "offline" ? "SERVICE_UNAVAILABLE" : "INTERNAL_ERROR",
      message: "Simulated mutation failure",
      userMessage: "Something went wrong. Please try again later.",
      correlationId,
    });
  }

  const updated = updateReferenceUser(userId, body);
  if (!updated) {
    return errorResponse(404, {
      code: "NOT_FOUND",
      message: "User not found",
      userMessage: "The requested user could not be found.",
      correlationId,
    });
  }

  return jsonWithCorrelation(updated, 200, correlationId);
}

export async function handleDeleteUserScenario(
  userId: string,
  context: ScenarioContext
): Promise<NextResponse<null | ApiError>> {
  const { correlationId, scenario } = context;

  await applyScenarioDelay(scenario);

  if (scenario === "server-error" || scenario === "offline") {
    return errorResponse(scenario === "offline" ? 503 : 500, {
      code: scenario === "offline" ? "SERVICE_UNAVAILABLE" : "INTERNAL_ERROR",
      message: "Simulated delete failure",
      userMessage: "Something went wrong. Please try again later.",
      correlationId,
    });
  }

  const deleted = deleteReferenceUser(userId);
  if (!deleted) {
    return errorResponse(404, {
      code: "NOT_FOUND",
      message: "User not found",
      userMessage: "The requested user could not be found.",
      correlationId,
    });
  }

  return new NextResponse(null, {
    status: 204,
    headers: { [CORRELATION_ID_HEADER]: correlationId },
  });
}
