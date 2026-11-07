/**
 * @jest-environment node
 */

/**
 * Web Vitals route request limits.
 *
 * Runs in the Node environment so the route receives real WHATWG Request streams.
 */

import { describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

import { POST } from "../route";

const URL = "http://localhost/api/telemetry/web-vitals";

function streamOf(text: string, chunkSize = 16 * 1024): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.byteLength) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(offset, offset + chunkSize));
      offset += chunkSize;
    },
  });
}

function chunkedRequest(text: string, ip: string): NextRequest {
  // No Content-Length header: simulates a chunked request that bypasses the header check.
  return new NextRequest(URL, {
    method: "POST",
    body: streamOf(text),
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    duplex: "half",
  } as ConstructorParameters<typeof NextRequest>[1]);
}

describe("POST /api/telemetry/web-vitals limits", () => {
  it("rejects bodies over the byte limit even without Content-Length", async () => {
    const oversized = JSON.stringify({ metrics: [], padding: "x".repeat(200 * 1024) });
    const response = await POST(chunkedRequest(oversized, "10.0.0.1"));

    expect(response.status).toBe(413);
  });

  it("rejects oversized metric arrays before schema validation", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const body = JSON.stringify({ metrics: Array.from({ length: 51 }, () => ({})) });
    const response = await POST(chunkedRequest(body, "10.0.0.2"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid payload" });
    consoleError.mockRestore();
  });

  it("still validates in-limit payloads with the schema", async () => {
    const response = await POST(chunkedRequest(JSON.stringify({ metrics: [{}] }), "10.0.0.3"));
    const json = (await response.json()) as { error?: string; details?: unknown };

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid payload");
    expect(json.details).toBeDefined();
  });
});
