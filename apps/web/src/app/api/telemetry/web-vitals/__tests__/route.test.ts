/**
 * Web Vitals API Route Tests
 */

import { describe, it, expect } from "@jest/globals";
import { NextRequest } from "next/server";

import { POST, GET } from "../route";

describe("Web Vitals API Route", () => {
  describe("GET /api/telemetry/web-vitals", () => {
    it("should return health check status", async () => {
      const response = GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("ok");
      expect(data.service).toBe("web-vitals-telemetry");
    });
  });

  describe("POST /api/telemetry/web-vitals", () => {
    it("should accept valid batch payload", async () => {
      const validPayload = {
        metrics: [
          {
            name: "LCP",
            value: 2500,
            rating: "good",
            id: "v1-123",
            route: "/",
            timestamp: Date.now(),
            environment: "production",
            appName: "atlas-web",
          },
        ],
        sessionId: "session-123",
        userAgent: "chrome",
      };

      const request = new NextRequest("http://localhost:3000/api/telemetry/web-vitals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should reject invalid metric name", async () => {
      const invalidPayload = {
        metrics: [
          {
            name: "INVALID_METRIC",
            value: 100,
            id: "v1-123",
            route: "/",
            timestamp: Date.now(),
            environment: "production",
            appName: "atlas-web",
          },
        ],
        sessionId: "session-123",
      };

      const request = new NextRequest("http://localhost:3000/api/telemetry/web-vitals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(invalidPayload),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("should reject empty metrics array", async () => {
      const invalidPayload = {
        metrics: [],
        sessionId: "session-123",
      };

      const request = new NextRequest("http://localhost:3000/api/telemetry/web-vitals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(invalidPayload),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("should reject missing required fields", async () => {
      const invalidPayload = {
        metrics: [
          {
            name: "LCP",
            value: 100,
            // Missing required fields
          },
        ],
        sessionId: "session-123",
      };

      const request = new NextRequest("http://localhost:3000/api/telemetry/web-vitals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(invalidPayload),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("should handle malformed JSON", async () => {
      const request = new NextRequest("http://localhost:3000/api/telemetry/web-vitals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "not valid json",
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });
});
