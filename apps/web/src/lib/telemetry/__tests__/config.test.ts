/**
 * Web Vitals Configuration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

import { getWebVitalsConfig, shouldReportVitals } from "../config";

describe("Web Vitals Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    // Clear sessionStorage mock if needed
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.clear();
    }
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getWebVitalsConfig", () => {
    it("should return production config by default", () => {
      const config = getWebVitalsConfig();

      expect(config.appName).toBe("atlas-web");
      expect(config.endpoint).toBe("/api/telemetry/web-vitals");
    });

    it("should respect NEXT_PUBLIC_WEB_VITALS_ENABLED override", () => {
      process.env.NEXT_PUBLIC_WEB_VITALS_ENABLED = "true";
      const config = getWebVitalsConfig();

      expect(config.enabled).toBe(true);
    });

    it("should respect NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE override", () => {
      process.env.NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE = "0.5";
      const config = getWebVitalsConfig();

      expect(config.sampleRate).toBe(0.5);
    });

    it("should clamp sample rate to 0-1 range", () => {
      process.env.NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE = "1.5";
      const config = getWebVitalsConfig();

      expect(config.sampleRate).toBe(1);
    });

    it("should respect endpoint override", () => {
      process.env.NEXT_PUBLIC_WEB_VITALS_ENDPOINT = "/custom/endpoint";
      const config = getWebVitalsConfig();

      expect(config.endpoint).toBe("/custom/endpoint");
    });

    it("should use staging sample rate", () => {
      // Save original values
      const originalEnv = process.env.NEXT_PUBLIC_APP_ENV;
      const originalRate = process.env.NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE;

      // Set staging environment and clear sample rate override
      process.env.NEXT_PUBLIC_APP_ENV = "staging";
      delete process.env.NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE;

      // Need to reload the module to pick up env changes
      jest.resetModules();
      const { getWebVitalsConfig: getConfig } = require("../config");
      const config = getConfig();

      expect(config.environment).toBe("staging");
      expect(config.sampleRate).toBe(0.25);

      // Restore originals
      process.env.NEXT_PUBLIC_APP_ENV = originalEnv;
      if (originalRate !== undefined) {
        process.env.NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE = originalRate;
      }
    });
  });

  describe("shouldReportVitals", () => {
    it("should return false for 0 sample rate", () => {
      expect(shouldReportVitals(0)).toBe(false);
    });

    it("should return true for 1 sample rate", () => {
      expect(shouldReportVitals(1)).toBe(true);
    });

    it("should return consistent result for same session", () => {
      const rate = 0.5;
      const first = shouldReportVitals(rate);
      const second = shouldReportVitals(rate);

      expect(first).toBe(second);
    });
  });
});
