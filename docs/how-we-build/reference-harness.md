# Reference harness

Deterministic local auth and API adapters for exercising Atlas without Google OAuth, proprietary
backends, or external services.

## When to use

| Path                  | Use case                                                              |
| --------------------- | --------------------------------------------------------------------- |
| **Reference harness** | Zero-credential local evaluation, Playwright, teaching Atlas patterns |
| **Real OAuth**        | Production-like auth with Google credentials                          |
| **External API**      | Integration against a real backend at `NEXT_PUBLIC_API_URL`           |

Reference mode is **not** evidence that production OAuth or API security is correct.

## Enable reference mode

Add to `apps/web/.env.local`:

```bash
ATLAS_REFERENCE_MODE=true
NEXT_PUBLIC_API_URL=/api/reference
AUTH_SESSION_SECRET=local-reference-session-secret-32chars
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Restart the dev server, then open `/reference`.

## Auth personas

| Persona           | Session                       | Reference profile metadata |
| ----------------- | ----------------------------- | -------------------------- |
| `anonymous`       | Signed out                    | —                          |
| `reference-user`  | `reference.user@atlas.local`  | `user`                     |
| `reference-admin` | `reference.admin@atlas.local` | `user`, `admin`            |

Profile metadata lives on reference fixtures only. Sessions use the standard `OAuthUser` contract
without roles. The reference adapter maps profile roles to typed permissions — see
[authorization.md](./authorization.md).

| Persona           | Effective permissions                                        |
| ----------------- | ------------------------------------------------------------ |
| `reference-user`  | `users.read`                                                 |
| `reference-admin` | `users.read`, `users.create`, `users.update`, `users.delete` |

Select personas via the `/reference` control panel or programmatically:

```bash
curl -X POST http://localhost:3000/api/reference/auth/session \
  -H 'Content-Type: application/json' \
  -d '{"persona":"reference-user","scenario":{"users":"success"}}' \
  --cookie-jar cookies.txt --cookie cookies.txt
```

Sessions use the same `SessionData` / `createSessionCookie` contract as Google OAuth. `useSession`,
`/api/auth/me`, and server session helpers behave identically.

## API scenarios

Users resource scenarios (query `?scenario=` or `x-atlas-reference-scenario` header):

| Scenario       | Behavior                   |
| -------------- | -------------------------- |
| `success`      | Deterministic seeded users |
| `empty`        | Empty list                 |
| `validation`   | 422 validation error       |
| `unauthorized` | 401                        |
| `forbidden`    | 403                        |
| `server-error` | 500                        |
| `slow`         | 1.5s delay then success    |
| `offline`      | 503 service unavailable    |

### Scenario helper (tests)

```typescript
import { referenceScenario, referenceScenarioHeader } from "@/test";

const header = referenceScenarioHeader({ auth: "reference-user", users: "empty" });
```

## Reset

```bash
curl -X POST http://localhost:3000/api/reference/reset --cookie cookies.txt
```

Resets the in-memory users store and clears the scenario cookie.

## Production safety

Reference adapters **cannot** activate in production:

1. `getServerEnvSchema("production")` rejects `ATLAS_REFERENCE_MODE=true`
2. `isReferenceModeEnabled()` returns false when `NODE_ENV` or `NEXT_PUBLIC_APP_ENV` is `production`
3. `/reference` routes return 404 when reference mode is off

Automated tests in `validate-server-env.test.ts` and `lib/reference/__tests__/mode.test.ts` prove
these guards.

## Architecture boundaries

| Layer                    | Location                                          |
| ------------------------ | ------------------------------------------------- |
| Application contract     | `useSession`, `api.users.*`, OpenAPI types        |
| Reference adapters       | `lib/reference/**`, `/api/reference/**`           |
| Developer UI             | `/reference`, `features/reference/`               |
| Authorization (#41)      | `lib/authz/`, reference role → permission adapter |
| Future #39 reference app | Consumes this harness; not implemented here       |

## Real provider configuration

For Google OAuth, see [env.md](./env.md) OAuth profile and
[ADR 0004](../adr/0004-oauth-google-pkce.md).
