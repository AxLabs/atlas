/**
 * @jest-environment node
 */

import { getApiBaseUrl } from "../config";

describe("getApiBaseUrl", () => {
  const originalWindow = global.window;

  afterEach(() => {
    global.window = originalWindow;
    process.env.NEXT_PUBLIC_API_URL = "/api";
  });

  it("returns the server API base URL when window is absent", async () => {
    // @ts-expect-error Jest setup installs a window stub even in node tests
    delete global.window;
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
    await expect(getApiBaseUrl()).resolves.toBe("https://api.example.com");
  });

  it("throws when called from a window environment", async () => {
    // @ts-expect-error simulate browser bundle
    global.window = {};
    await expect(getApiBaseUrl()).rejects.toThrow(/server-only/);
  });
});
