# Quickstart

> What to expect when you run Atlas for the first time.

---

## Overview

Atlas is a complete frontend platform template. When you run it, you get:

- A Next.js application with TypeScript strict mode
- A shared UI component library (`packages/ui`)
- Configured tooling (linting, testing, type checking)
- Minimal reference examples under `/examples`
- Optional zero-credential reference harness at `/reference` (see below)

---

## Prerequisites

- **Repository access** (selected clients, collaborators, or evaluators)
- **Node.js 22+**
- **pnpm 10+**

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for access and setup expectations.

---

## First Launch

```bash
corepack enable
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm validate:env
pnpm dev
```

The application launches at `http://localhost:3000`.

---

## Local evaluation paths

Atlas supports two local workflows. Pick the one that matches your goal.

### Zero-credential reference harness (recommended for first evaluation)

No Google OAuth credentials and no external backend are required. The harness uses deterministic
reference fixtures for auth and API responses — development and reference only, **not** evidence of
production OAuth or API security.

Add to `apps/web/.env.local`:

```bash
ATLAS_REFERENCE_MODE=true
NEXT_PUBLIC_API_URL=/api/reference
AUTH_SESSION_SECRET=local-reference-session-secret-32chars
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Then:

```text
pnpm dev
→ open /reference
→ select anonymous / reference-user / reference-admin
→ select deterministic API scenarios
```

See [Reference harness](../how-we-build/reference-harness.md) for personas, scenarios, reset, and
test helpers.

### Real Google OAuth and external API

For production-like auth, configure Google OAuth credentials and point `NEXT_PUBLIC_API_URL` at your
backend. This path is separate from the reference harness.

See the canonical [environment variables](../how-we-build/env.md) guide (OAuth profile) and
[ADR 0004: Google OAuth with PKCE](../adr/0004-oauth-google-pkce.md).

### Examples-only template (default `.env.example`)

The default `.env.local` copy runs `/examples` with in-memory mock APIs — no reference harness and
no OAuth setup required.

---

## What You'll See

### Home page

Landing page with a link to **View examples** and platform overview copy.

### Examples (`/examples`)

Small reference section included in the template:

| Route            | What it demonstrates                      |
| ---------------- | ----------------------------------------- |
| `/examples`      | Overview                                  |
| `/examples/data` | React Query + loading/empty/error/success |
| `/examples/form` | Zod validation + server field errors      |

Examples use in-memory mock APIs under `/api/examples/*`. State resets on server restart.

### Data state modes

Force UI states via query param on the data example:

- `/examples/data?mode=success`
- `/examples/data?mode=empty`
- `/examples/data?mode=error`
- `/examples/data?mode=slow`

---

## Developer tools

- **React Query Devtools** — when examples routes mount `DataProviderLayout`
- **Storybook** — `pnpm storybook` → `http://localhost:6006`
- **`/__flags`** — feature flag dev panel (development only)

---

## What comes next

1. Enable the [reference harness](../how-we-build/reference-harness.md) or explore `/examples` to
   see platform patterns in code
2. Read [Architecture](architecture.md) for the system mental model
3. Delete `app/examples/`, `features/examples/`, and `api/examples/` when you start your product
4. Add features under `apps/web/src/features/` following `features/reference/users/` for OpenAPI
   APIs

See [Examples](examples.md) for more detail.
