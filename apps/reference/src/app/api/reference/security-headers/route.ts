/**
 * Reference-only endpoint exposing interpreted security header evidence.
 *
 * Returns configuration summary and actual response headers from this request
 * (excluding sensitive values).
 */

import { NextResponse } from "next/server";

import { getSafeSecuritySummary } from "@/lib/reference/platform-runtime";
import { getCSPHeaderName } from "@/lib/security/csp";

const OBSERVED_HEADER_KEYS = [
  "content-security-policy",
  "content-security-policy-report-only",
  "strict-transport-security",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
  "x-request-id",
] as const;

export async function GET(request: Request): Promise<NextResponse> {
  const summary = getSafeSecuritySummary();
  const cspHeaderName = getCSPHeaderName(summary.cspMode);

  const observed: Record<string, string> = {};
  for (const key of OBSERVED_HEADER_KEYS) {
    const value = request.headers.get(key);
    if (value) {
      observed[key] = value;
    }
  }

  const response = NextResponse.json({
    summary,
    expectedCspHeader: cspHeaderName ?? null,
    observedRequestHeaders: observed,
    note: "Response headers from next.config.js and proxy apply on outbound responses; this endpoint reports inbound request headers and configuration.",
  });

  for (const key of OBSERVED_HEADER_KEYS) {
    const value = response.headers.get(key);
    if (value) {
      observed[`response:${key}`] = value;
    }
  }

  return response;
}
