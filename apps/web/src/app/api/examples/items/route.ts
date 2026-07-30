/**
 * Reference example items API.
 *
 * @module api/examples/items
 */

import { NextResponse } from "next/server";

import { CORRELATION_ID_HEADER, generateCorrelationId } from "@/lib/api/correlation";

import { createItem, getItems } from "./store";

import type { ExampleItem } from "./store";
import type { NextRequest } from "next/server";

interface ListResponse {
  data: ExampleItem[];
  meta: {
    total: number;
    mode: string;
  };
}

interface ApiErrorResponse {
  code: string;
  message: string;
  userMessage: string;
  correlationId: string;
  details?: {
    fieldErrors?: Record<string, string[]>;
  };
}

interface CreateItemBody {
  title?: unknown;
  description?: unknown;
}

function validateCreateItem(
  body: CreateItemBody
):
  | { valid: true; data: { title: string; description?: string } }
  | { valid: false; errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};

  if (typeof body.title !== "string" || body.title.trim().length === 0) {
    errors.title = ["Title is required"];
  } else if (body.title.length < 3) {
    errors.title = ["Title must be at least 3 characters"];
  } else if (body.title.length > 100) {
    errors.title = ["Title must be at most 100 characters"];
  }

  if (body.description !== undefined && typeof body.description !== "string") {
    errors.description = ["Description must be a string"];
  } else if (typeof body.description === "string" && body.description.length > 500) {
    errors.description = ["Description must be at most 500 characters"];
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      title: (body.title as string).trim(),
      description: body.description ? (body.description as string).trim() : undefined,
    },
  };
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<ListResponse | ApiErrorResponse>> {
  const correlationId = request.headers.get(CORRELATION_ID_HEADER) ?? generateCorrelationId();
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") ?? "success";

  switch (mode) {
    case "slow": {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const data = getItems();
      return NextResponse.json<ListResponse>(
        { data, meta: { total: data.length, mode } },
        { headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    case "empty": {
      return NextResponse.json<ListResponse>(
        { data: [], meta: { total: 0, mode } },
        { headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    case "error": {
      return NextResponse.json<ApiErrorResponse>(
        {
          code: "EXAMPLE_ERROR",
          message: "Simulated error for example purposes",
          userMessage: "Something went wrong fetching the items.",
          correlationId,
        },
        { status: 500, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    case "success":
    default: {
      const data = getItems();
      return NextResponse.json<ListResponse>(
        { data, meta: { total: data.length, mode: "success" } },
        { headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }
  }
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ExampleItem | ApiErrorResponse>> {
  const correlationId = request.headers.get(CORRELATION_ID_HEADER) ?? generateCorrelationId();

  try {
    const body = (await request.json()) as CreateItemBody;
    const validation = validateCreateItem(body);

    if (!validation.valid) {
      return NextResponse.json<ApiErrorResponse>(
        {
          code: "VALIDATION_FAILED",
          message: "Request validation failed",
          userMessage: "Please check your input and try again.",
          correlationId,
          details: {
            fieldErrors: validation.errors,
          },
        },
        { status: 422, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    const item = createItem(validation.data);
    return NextResponse.json<ExampleItem>(item, {
      status: 201,
      headers: { [CORRELATION_ID_HEADER]: correlationId },
    });
  } catch {
    return NextResponse.json<ApiErrorResponse>(
      {
        code: "INVALID_JSON",
        message: "Failed to parse request body as JSON",
        userMessage: "Invalid request format. Please try again.",
        correlationId,
      },
      { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
    );
  }
}
