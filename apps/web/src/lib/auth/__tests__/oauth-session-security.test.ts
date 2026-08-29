/**
 * OAuth / session negative-path tests for Atlas issue #14.
 *
 * @jest-environment node
 */

import { cookies } from "next/headers";

import { generateChallenge, generateVerifier } from "@/lib/auth/pkce";
import { GET as googleCallback } from "@/app/api/auth/google/callback/route";
import { GET as googleStart } from "@/app/api/auth/google/start/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as refresh } from "@/app/api/auth/refresh/route";
import {
  createSessionCookie,
  destroySessionCookie,
  readSession,
  setOAuthTempCookie,
} from "@/lib/auth/session";
import { generateState, verifyState } from "@/lib/auth/state";

import type { SessionData } from "@/lib/auth/types";

const { URL: NodeURL } = require("node:url") as { URL: typeof URL };

jest.mock("next/server", () => ({
  NextResponse: {
    redirect(url: URL | string) {
      const location = typeof url === "string" ? url : url.toString();
      return {
        status: 307,
        headers: {
          get: (name: string) => (name.toLowerCase() === "location" ? location : null),
        },
      };
    },
    json(body: unknown, init?: { status?: number }) {
      return {
        status: init?.status ?? 200,
        json: async () => body,
        body,
      };
    },
  },
}));

jest.mock("@/lib/auth/providers/google", () => {
  const actual = jest.requireActual("@/lib/auth/providers/google");
  return {
    ...actual,
    exchangeCodeForTokens: jest.fn(),
    fetchGoogleUserInfo: jest.fn(),
    refreshAccessToken: jest.fn(),
  };
});

function makeRequest(url: string) {
  return { nextUrl: new NodeURL(url) } as { nextUrl: URL };
}

function locationOf(response: { headers: { get: (name: string) => string | null } }) {
  return response.headers.get("location");
}

function sessionFixture(overrides: Partial<SessionData> = {}): SessionData {
  const now = Math.floor(Date.now() / 1000);
  return {
    user: {
      provider: "google",
      providerAccountId: "sub-1",
      email: "user@example.com",
      name: "Test User",
      avatarUrl: null,
    },
    accessToken: "access-token-value",
    refreshToken: "refresh-token-value",
    accessTokenExpiresAt: now + 3600,
    createdAt: now,
    expiresAt: now + 86_400,
    ...overrides,
  };
}

describe("PKCE and OAuth state", () => {
  it("generates a high-entropy verifier and S256 challenge", async () => {
    const verifier = generateVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(verifier.length).toBeGreaterThan(32);
    const challenge = await generateChallenge(verifier);
    expect(challenge).not.toEqual(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("rejects mismatched OAuth state", () => {
    const expected = generateState();
    expect(verifyState(expected, expected)).toBe(true);
    expect(verifyState("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", expected)).toBe(false);
  });
});

describe("OAuth start redirect handling", () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_APP_ENV = "development";
    global.URL = NodeURL;
  });

  it("rejects an unsafe external returnTo", async () => {
    const response = await googleStart(
      makeRequest(
        "http://localhost:3000/api/auth/google/start?returnTo=https://evil.example/phish"
      ) as never
    );
    const location = locationOf(response);
    expect(location).toContain("accounts.google.com");
    const cookieStore = await cookies();
    const temp = cookieStore.get("atlas_oauth_tmp");
    expect(temp?.value).toBeTruthy();
    const parsed = JSON.parse(String(temp?.value)) as { returnTo?: string };
    expect(parsed.returnTo).toBeUndefined();
  });

  it("keeps a same-origin returnTo path", async () => {
    const response = await googleStart(
      makeRequest("http://localhost:3000/api/auth/google/start?returnTo=/dashboard") as never
    );
    expect(locationOf(response)).toContain("accounts.google.com");
    const cookieStore = await cookies();
    const parsed = JSON.parse(String(cookieStore.get("atlas_oauth_tmp")?.value)) as {
      returnTo?: string;
    };
    expect(parsed.returnTo).toBe("/dashboard");
  });
});

describe("OAuth callback negative paths", () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    global.URL = NodeURL;
  });

  it("rejects a callback without state", async () => {
    const response = await googleCallback(
      makeRequest("http://localhost:3000/api/auth/google/callback?code=abc") as never
    );
    expect(locationOf(response)).toContain("error=missing_params");
  });

  it("rejects a callback without an OAuth temp cookie", async () => {
    const response = await googleCallback(
      makeRequest("http://localhost:3000/api/auth/google/callback?code=abc&state=xyz") as never
    );
    expect(locationOf(response)).toContain("error=missing_state");
  });

  it("rejects a mismatched state", async () => {
    await setOAuthTempCookie({
      verifier: generateVerifier(),
      state: generateState(),
      returnTo: "/",
    });
    const response = await googleCallback(
      makeRequest(
        "http://localhost:3000/api/auth/google/callback?code=abc&state=not-the-stored-state"
      ) as never
    );
    expect(locationOf(response)).toContain("error=invalid_state");
  });

  it("redirects OAuth provider errors without creating a session", async () => {
    const response = await googleCallback(
      makeRequest("http://localhost:3000/api/auth/google/callback?error=access_denied") as never
    );
    expect(locationOf(response)).toContain("error=access_denied");
    expect(await readSession()).toBeNull();
  });
});

describe("session cookies and endpoints", () => {
  beforeEach(() => {
    process.env.AUTH_SESSION_SECRET = "test-session-secret-32-chars-min";
    process.env.NEXT_PUBLIC_APP_ENV = "development";
    process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
  });

  it("sets httpOnly, SameSite=Lax, Path=/, and Secure in production", async () => {
    process.env.NEXT_PUBLIC_APP_ENV = "production";
    await createSessionCookie(sessionFixture());
    const store = await cookies();
    const call = (store.set as jest.Mock).mock.calls.find((entry) => entry[0] === "atlas_session");
    expect(call).toBeTruthy();
    expect(call?.[2]).toEqual(
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
      })
    );
    expect(typeof call?.[2].maxAge).toBe("number");
  });

  it("does not set Secure in development", async () => {
    process.env.NEXT_PUBLIC_APP_ENV = "development";
    await createSessionCookie(sessionFixture());
    const store = await cookies();
    const call = (store.set as jest.Mock).mock.calls.find((entry) => entry[0] === "atlas_session");
    expect(call?.[2]).toEqual(expect.objectContaining({ httpOnly: true, secure: false }));
  });

  it("treats a malformed session cookie as unauthenticated", async () => {
    const store = await cookies();
    store.set("atlas_session", "not-valid-ciphertext");
    expect(await readSession()).toBeNull();
  });

  it("returns unauthenticated for /api/auth/me without a session", async () => {
    const response = await me();
    await expect(response.json()).resolves.toEqual({ authenticated: false });
  });

  it("does not expose tokens from /api/auth/me", async () => {
    await createSessionCookie(sessionFixture());
    const response = await me();
    const body = await response.json();
    expect(body.authenticated).toBe(true);
    expect(JSON.stringify(body)).not.toContain("access-token-value");
    expect(JSON.stringify(body)).not.toContain("refresh-token-value");
    expect(body.user.email).toBe("user@example.com");
  });

  it("rejects refresh without a session", async () => {
    const response = await refresh();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Not authenticated" });
  });

  it("rejects refresh without a refresh token and does not invent auth state", async () => {
    await createSessionCookie(sessionFixture({ refreshToken: null }));
    const response = await refresh();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "No refresh token available" });
    const session = await readSession();
    expect(session?.accessToken).toBe("access-token-value");
  });

  it("clears the session cookie on logout", async () => {
    await createSessionCookie(sessionFixture());
    expect(await readSession()).not.toBeNull();
    const response = await logout();
    expect(response.status).toBe(200);
    const store = await cookies();
    const call = (store.set as jest.Mock).mock.calls.find(
      (entry) => entry[0] === "atlas_session" && entry[2]?.maxAge === 0
    );
    expect(call).toBeTruthy();
    await destroySessionCookie();
    store.set("atlas_session", "");
    expect(await readSession()).toBeNull();
  });
});
