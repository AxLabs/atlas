# ADR-0004: OAuth with Google PKCE

## Status

**Accepted**

## Context

Atlas needs user authentication. Requirements:

- Social login (Google initially)
- Secure token handling
- No tokens in localStorage
- Server-side token exchange
- Session management

We evaluated:

1. NextAuth.js
2. Clerk/Auth0 (managed services)
3. Custom OAuth implementation

### Security Requirements

- Authorization Code flow (not Implicit)
- PKCE for code interception protection
- httpOnly cookies for token storage
- Server-side refresh token handling

## Decision

We implement **custom OAuth 2.0 with Authorization Code + PKCE** using Google as the provider. No
NextAuth.js.

### Implementation

1. **OAuth flow handlers** (`app/api/auth/google/*`):

   - `/start` — Generates PKCE challenge, redirects to Google
   - `/callback` — Exchanges code for tokens, creates session

2. **PKCE implementation** (`lib/auth/pkce.ts`):

   - 256-bit verifier
   - SHA-256 challenge
   - Stored in httpOnly cookie during flow

3. **Session management** (`lib/auth/session.ts`):

   - AES-256-GCM encrypted session cookie
   - Contains access token, refresh token, user info
   - httpOnly, Secure, SameSite=Lax
   - Provider-neutral read/write/expiration primitives only

4. **Google token refresh** (`lib/auth/providers/google/session-refresh.ts`):

   - Reference integration that refreshes Google tokens and updates the session cookie
   - Used by `/api/auth/me` and `/api/auth/refresh` in the reference Google OAuth flow

5. **Client hook** (`lib/auth/useSession.ts`):

   - Fetches session from `/api/auth/me`
   - Returns user info (never tokens)
   - Handles loading/error states

Token refresh is server-side in the Google reference layer and transparent to the client via
`/api/auth/me`.

### Security Properties

| Property                     | Implementation                  |
| ---------------------------- | ------------------------------- |
| No tokens in localStorage    | ✓ Encrypted cookie only         |
| No client-side secrets       | ✓ Server handles token exchange |
| CSRF protection              | ✓ State parameter validation    |
| Code interception protection | ✓ PKCE                          |
| Session encryption           | ✓ AES-256-GCM                   |

## Alternatives Considered

### Alternative 1: NextAuth.js

**Pros:**

- Popular, well-maintained
- Many providers built-in
- Database adapters
- Good documentation

**Cons:**

- Heavy abstraction
- Session handling opinionated
- Harder to customize
- OAuth-specific edge cases

**Why not chosen:** We needed full control over the OAuth flow and session management. NextAuth's
abstractions made customization difficult.

### Alternative 2: Clerk/Auth0

**Pros:**

- Fully managed
- UI components included
- Advanced features (MFA, etc.)
- Less code to maintain

**Cons:**

- Vendor lock-in
- Monthly cost
- Data residency concerns
- Less control

**Why not chosen:** Team preferred self-hosted solution with full control.

### Alternative 3: Passport.js

**Pros:**

- Mature ecosystem
- Many strategies

**Cons:**

- Express-centric
- Awkward with Next.js App Router
- Callback-based API

**Why not chosen:** Not designed for Next.js App Router.

## Consequences

### Positive

- Full control over auth flow
- No third-party dependencies for core auth
- Secure by default (PKCE, encrypted sessions)
- Easy to add new providers
- No vendor costs

### Negative

- More code to maintain
- Security responsibility on team
- Must implement MFA separately if needed
- No pre-built UI components

### Neutral

- Google is the **reference** identity provider — not the universal Atlas auth model. Platform
  session security (`lib/auth/session.ts`, PKCE, encrypted cookies) is provider-independent.
- Additional providers follow the same pattern as `lib/auth/providers/google.ts`

## Platform vs reference

| Layer                                           | Classification | Location                                                           |
| ----------------------------------------------- | -------------- | ------------------------------------------------------------------ |
| Session storage (encrypted cookies, read/write) | Core platform  | `lib/auth/session.ts`                                              |
| Server session helper (read-only)               | Core platform  | `lib/auth/server.ts`                                               |
| PKCE, CSRF state                                | Core platform  | `lib/auth/pkce.ts`, `lib/auth/state.ts`                            |
| Client session hook                             | Core platform  | `lib/auth/useSession.ts`                                           |
| Google token refresh orchestration              | Reference      | `lib/auth/providers/google/session-refresh.ts`                     |
| Google OAuth provider                           | Reference      | `lib/auth/providers/google.ts`                                     |
| Google OAuth routes                             | Reference      | `app/api/auth/google/*`, `app/api/auth/me`, `app/api/auth/refresh` |
| Auth UI components                              | Reference      | `components/reference/auth/`                                       |

Consumers replace Google-specific layers with their chosen IdP while keeping the session
architecture.

## References

- [OAuth 2.0 RFC](https://datatracker.ietf.org/doc/html/rfc6749)
- [PKCE RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)
- [Google OAuth Docs](https://developers.google.com/identity/protocols/oauth2)
- Implementation: `apps/web/src/lib/auth/`, `apps/web/src/app/api/auth/`
