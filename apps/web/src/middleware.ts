import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

/**
 * Middleware to ensure every request has a correlation ID (x-request-id)
 * - Preserves incoming x-request-id if provided
 * - Generates a new UUID if not provided
 * - Adds x-request-id to response headers
 * - Excludes static assets
 */
export function middleware(request: NextRequest) {
  // Skip static assets
  const pathname = request.nextUrl.pathname;
  if (
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Get or generate request ID
  const existingRequestId = request.headers.get("x-request-id");
  const requestId = existingRequestId ?? crypto.randomUUID();

  // Create new headers with x-request-id
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  // Create response with modified headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Add x-request-id to response headers
  response.headers.set("x-request-id", requestId);

  return response;
}

/**
 * Configure which routes this middleware runs on
 * We want it on all routes except static assets (handled above)
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
