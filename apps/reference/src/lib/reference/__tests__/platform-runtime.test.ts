import { containsSensitiveData } from "@/lib/security/redact";

import {
  FORBIDDEN_PLATFORM_KEYS,
  getSafePlatformRuntime,
  getSafeSecuritySummary,
} from "../platform-runtime";

describe("platform-runtime", () => {
  it("returns safe runtime without sensitive fields", () => {
    const runtime = getSafePlatformRuntime();
    expect(runtime.application).toBe("@atlas/reference");
    expect(containsSensitiveData(runtime)).toBe(false);

    const serialized = JSON.stringify(runtime);
    for (const key of FORBIDDEN_PLATFORM_KEYS) {
      expect(serialized.toLowerCase()).not.toContain(key.toLowerCase());
    }
  });

  it("returns interpreted security summary", () => {
    const security = getSafeSecuritySummary();
    expect(security.cspMode).toMatch(/^(off|report-only|enforce)$/);
    expect(typeof security.hstsEnabled).toBe("boolean");
    expect(security.referrerPolicy).toBeTruthy();
    expect(security.permissionsPolicy).toBeTruthy();
    expect(security.baselineHeaderCount).toBeGreaterThan(0);
    expect(containsSensitiveData(security)).toBe(false);
  });

  it("reports client and server Sentry separately", () => {
    const runtime = getSafePlatformRuntime();
    expect(runtime.sentry.client).toEqual(
      expect.objectContaining({
        configured: expect.any(Boolean),
      })
    );
    expect(runtime.sentry.server).toEqual(
      expect.objectContaining({
        configured: expect.any(Boolean),
      })
    );
    expect(containsSensitiveData(runtime.sentry)).toBe(false);
  });
});
