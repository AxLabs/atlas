# Quickstart

> What to expect when you run Atlas for the first time.

---

## Overview

Atlas is a complete frontend platform template. When you run it, you get:

- A Next.js application with TypeScript strict mode
- A shared UI component library (`packages/ui`)
- Configured tooling (linting, testing, type checking)
- Minimal reference examples under `/examples`

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

1. Explore `/examples` to see platform patterns in code
2. Read [Architecture](architecture.md) for the system mental model
3. Delete `app/examples/`, `features/examples/`, and `api/examples/` when you start your product
4. Add features under `apps/web/src/features/` following `features/users/` for OpenAPI APIs

See [Examples](examples.md) for more detail.
