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

The reference harness runs in the **`apps/reference`** workspace application — not in the starter
app (`apps/web`).

```bash
pnpm install
cp apps/reference/.env.example apps/reference/.env.local
pnpm --filter @atlas/reference dev
```

Default local configuration (`apps/reference/.env.local`):

```bash
NEXT_PUBLIC_API_URL=/api
AUTH_SESSION_SECRET=local-reference-session-secret-32chars
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

Open `http://localhost:3001` for the reference application or `/harness` for developer controls.

Product routes (`/`, `/users`, `/profile`, `/settings`, `/authorization`, `/platform`) demonstrate
runtime capabilities. `/harness` remains the developer simulation layer — persona selection, API
scenarios, reset, and deterministic failures. Platform diagnostics live on `/platform`, not in the
harness.

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

Select personas via the `/harness` control panel or programmatically:

```bash
curl -X POST http://localhost:3001/api/auth/session \
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
curl -X POST http://localhost:3001/api/reset --cookie cookies.txt
```

Resets this browser's cookie-scoped in-memory users store (concurrent sessions do not share
mutations) and clears the scenario cookie.

## Production safety

Reference adapters **cannot** activate in production builds of `apps/reference`:

1. `getServerEnvSchema("production")` rejects `ATLAS_REFERENCE_MODE=true`
2. `isReferenceModeEnabled()` returns false when `NODE_ENV` or `NEXT_PUBLIC_APP_ENV` is `production`

The starter app (`apps/web`) does not ship reference adapters or routes.

Automated tests in `apps/reference` prove these guards.

## Architecture boundaries

| Layer                 | Location (`apps/reference`)                                        |
| --------------------- | ------------------------------------------------------------------ |
| Application contract  | `useSession`, `useTypedApiClient()` → `api.users.*`, OpenAPI types |
| Reference adapters    | `lib/reference/**`, `/api/**` harness routes                       |
| Developer UI          | `/harness`, harness components in `features/components/`           |
| Reference application | `/`, `/users`, `features/users` product UI                         |
| Authorization         | `lib/authz/`, reference role → permission adapter                  |

## Real provider configuration

For Google OAuth, see [env.md](./env.md) OAuth profile and
[ADR 0004](../adr/0004-oauth-google-pkce.md).
