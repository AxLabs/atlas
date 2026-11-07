/**
 * Web Vitals Telemetry API Route
 *
 * Receives and processes Web Vitals metrics from the client.
 * Validates payload, applies rate limiting, and stores/forwards metrics.
 *
 * @route POST /api/telemetry/web-vitals
 */

import { NextResponse } from "next/server";

import { type WebVitalsBatchDTO, WebVitalsBatchSchema } from "@/lib/telemetry/validation";

import type { NextRequest } from "next/server";

/**
 * Maximum request body size (100KB)
 */
const MAX_BODY_SIZE = 100 * 1024;

/**
 * Maximum metrics per batch. Mirrors WebVitalsBatchSchema and is checked before schema
 * validation so oversized arrays are rejected without per-element parsing.
 */
const MAX_METRICS_PER_BATCH = 50;

/**
 * Rate limiting: track requests per IP
 * In production, use Redis or a proper rate limiting service
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 20; // 20 requests per minute per IP

/**
 * Check rate limit for IP address
 */
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Get client IP from request
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Read the request body, enforcing MAX_BODY_SIZE on the bytes actually received.
 * The Content-Length header is optional (chunked requests omit it), so it cannot be the only cap.
 * Returns null when the body exceeds the limit.
 */
async function readBodyWithLimit(request: NextRequest, maxBytes: number): Promise<string | null> {
  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

/**
 * Reject batches whose metrics array is longer than allowed before schema validation runs.
 */
function exceedsMetricsLimit(body: unknown): boolean {
  if (typeof body !== "object" || body === null || !("metrics" in body)) {
    return false;
  }
  const { metrics } = body as { metrics: unknown };
  return Array.isArray(metrics) && metrics.length > MAX_METRICS_PER_BATCH;
}

/**
 * Store or forward Web Vitals metrics
 *
 * Currently logs to stdout in structured format.
 * TODO: Implement database persistence or forward to analytics service.
 */
function processMetrics(batch: WebVitalsBatchDTO): void {
  // Log structured data for collection by log aggregators (e.g., Loki, CloudWatch)
  console.log(
    JSON.stringify({
      type: "web-vitals",
      timestamp: new Date().toISOString(),
      sessionId: batch.sessionId,
      userAgent: batch.userAgent,
      metrics: batch.metrics.map((m) => ({
        name: m.name,
        value: m.value,
        rating: m.rating,
        route: m.route,
        environment: m.environment,
        appName: m.appName,
        buildId: m.buildId,
        timestamp: m.timestamp,
      })),
    })
  );

  // TODO: Persist to database
  // Example with Prisma:
  // await prisma.webVital.createMany({
  //   data: batch.metrics.map(metric => ({
  //     name: metric.name,
  //     value: metric.value,
  //     rating: metric.rating,
  //     route: metric.route,
  //     environment: metric.environment,
  //     sessionId: batch.sessionId,
  //     timestamp: new Date(metric.timestamp),
  //   }))
  // });

  // TODO: Forward to analytics service
  // Example with OpenTelemetry:
  // for (const metric of batch.metrics) {
  //   meter.createHistogram(metric.name).record(metric.value, {
  //     route: metric.route,
  //     rating: metric.rating,
  //   });
  // }
}

/**
 * POST /api/telemetry/web-vitals
 *
 * Accepts batched Web Vitals metrics from the client.
 */
export async function POST(request: NextRequest) {
  try {
    // Check content length
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    // Rate limiting
    const clientIp = getClientIp(request);
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // Read the body with an enforced byte limit, then validate
    const rawBody = await readBodyWithLimit(request, MAX_BODY_SIZE);
    if (rawBody === null) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    const body = JSON.parse(rawBody) as unknown;
    if (exceedsMetricsLimit(body)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const validationResult = WebVitalsBatchSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          details: validationResult.error.format(),
        },
        { status: 400 }
      );
    }

    // Process metrics
    processMetrics(validationResult.data);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[Web Vitals API] Error processing metrics:", error);

    // Don't leak error details to client
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/telemetry/web-vitals
 *
 * Health check endpoint
 */
export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "web-vitals-telemetry",
      version: "1.0.0",
    },
    { status: 200 }
  );
}
