# Folder Structure

> Where code lives and why.

## Monorepo Layout

```
atlas/
├── apps/
│   ├── web/                    # Clean Atlas consumer starter (@atlas/web)
│   │   ├── src/
│   │   │   ├── app/            # Next.js App Router pages & routes
│   │   │   ├── components/     # Shared app-level components
│   │   │   ├── features/       # Product + example feature modules
│   │   │   ├── lib/            # Shared utilities & infrastructure
│   │   │   ├── providers/      # React context providers
│   │   │   ├── schemas/        # Zod validation schemas
│   │   │   ├── env/            # Environment variable exports
│   │   │   ├── test/           # Test utilities, fixtures, factories
│   │   │   └── types/          # Shared TypeScript types
│   │   ├── e2e/                # Playwright E2E tests
│   │   └── scripts/            # Build & validation scripts
│   │
│   └── reference/              # Executable reference application (@atlas/reference)
│       ├── src/
│       │   ├── app/            # Reference product routes (/users, /harness, …)
│       │   ├── features/       # Reference product features (users CRUD, harness UI)
│       │   ├── lib/            # Platform conventions (mirrors starter lib/)
│       │   └── …               # Same structural layers as apps/web
│       └── e2e/                # Reference application E2E tests
│
├── packages/
│   ├── ui/                     # Shared UI component library
│   │   └── src/
│   │       ├── components/     # UI components
│   │       ├── hooks/          # Shared hooks (useTheme, etc.)
│   │       └── styles/         # Global CSS, design tokens
│   │
│   └── config/                 # Shared config (ESLint, TS, Jest)
│
├── docs/                       # Platform documentation
│   ├── how-we-build/           # ← You are here
│   ├── adr/                    # Architecture Decision Records
│   └── _archive/               # Historical documentation
│
├── openapi/                    # OpenAPI specification
└── tools/                      # Developer tooling
```

`atlas init` also writes `.github/workflows/ci.yml` in the generated project: a GitHub-hosted
quality baseline that you own after generation. It is not Atlas maintainer CI. See [CLI](cli.md).

## Key Directories Explained

### `apps/web/src/app/`

Next.js App Router pages and API routes for the **clean consumer starter**.

```
app/
├── examples/           # Starter reference patterns (delete when building product)
│   ├── layout.tsx
│   ├── page.tsx
│   ├── data/page.tsx
│   └── form/page.tsx
├── api/                # API route handlers
│   ├── auth/
│   ├── examples/       # Mock APIs for reference pages
│   └── health/
├── layout.tsx          # Root layout
├── page.tsx            # Home page
└── global-error.tsx    # Error boundary
```

**Rules:**

- ✅ Pages and layouts only — no business logic
- ✅ Use route groups `(folder)` for shared layouts
- ✅ API routes can use `fetch()` directly (they are API boundaries)
- ❌ Don't put reusable components here
- ❌ Do not ship the reference product here — it lives in `apps/reference`

### `apps/reference/src/app/`

Reference application routes — the coherent executable product journey.

```
app/
├── page.tsx            # Reference home
├── users/              # Users CRUD journey
├── profile/
├── authorization/
├── harness/            # Deterministic persona/scenario controls
├── api/                # Reference harness API routes
└── …
```

See [reference harness](reference-harness.md) for harness configuration.

### `apps/web/src/features/`

Feature modules in the starter contain product code and isolated examples.

```
features/
├── examples/           # Reference hooks for mock app routes (delete with /examples)
└── <product>/          # Consumer product features
```

### `apps/reference/src/features/`

Reference application product features.

```
features/
├── users/              # OpenAPI client hooks + consuming UI
├── components/         # Shared reference UI (shell, harness panels)
└── …
```

**Rules:**

- ✅ Each product feature is self-contained under `features/<name>/`
- ✅ Starter example modules live under `features/examples/` — not imported by product features
- ✅ Reference application features live under `apps/reference/src/features/`
- ✅ Export only public API from `index.ts`
- ✅ Keep query/mutation logic in feature, not in components
- ❌ Features should not import from other features directly
- ❌ Don't put shared utilities here — use `lib/`
- ❌ `apps/web` and `apps/reference` do not import each other's source code

See [architecture ownership](architecture-ownership.md) for the full classification.

### `apps/web/src/lib/` and `apps/reference/src/lib/`

Shared infrastructure and utilities. The reference application mirrors starter conventions
deliberately — see
[architecture ownership](architecture-ownership.md#duplicated-starterreference-infrastructure).

```
lib/
├── api/                # Central API client
│   ├── client.ts       # HTTP client with auth, retry, errors
│   ├── errors.ts       # ApiError class, normalization
│   ├── correlation.ts  # Request correlation IDs
│   ├── contracts/      # OpenAPI-generated types
│   └── index.ts
├── auth/               # Authentication module
│   ├── session.ts      # Session management (server)
│   ├── useSession.ts   # Session hook (client)
│   └── providers/      # OAuth providers
├── react-query/        # React Query setup
│   ├── provider.tsx    # QueryClient configuration
│   ├── keys.ts         # Query key factories
│   └── patterns.ts     # Mutation/invalidation helpers
├── telemetry/          # Sentry, web vitals
├── analytics/          # Analytics integration
├── feature-flags/      # Feature flag system
└── logging/            # Structured logging
```

**Rules:**

- ✅ Infrastructure code lives here
- ✅ Everything has an `index.ts` barrel export
- ❌ No UI components — those go in `components/` or `packages/ui`
- ❌ No domain logic — that goes in `features/`

### `apps/web/src/components/`

App-level shared components (not in the UI package).

```
components/
├── navigation/         # App-level navigation (AppBreadcrumbs)
└── …
```

**Rules:**

- ✅ Components that are specific to the web app
- ✅ Components that compose UI package primitives
- ❌ Generic/reusable components go in `packages/ui`

### `packages/ui/`

Shared UI component library consumed by both applications.

```
ui/src/
├── components/
│   ├── ui/             # Primitive components (Button, Card, etc.)
│   └── ...
├── hooks/
│   └── use-theme.ts    # Theme management
├── styles/
│   └── globals.css     # Design tokens, Tailwind config
└── index.ts            # Public exports
```

**Rules:**

- ✅ Generic, reusable components only
- ✅ Each component has tests
- ✅ Components documented in Storybook
- ❌ No app-specific logic
- ❌ No direct API calls

### `apps/web/src/test/`

Test utilities, fixtures, and factories.

```
test/
├── helpers/
│   ├── render.tsx      # renderWithProviders
│   ├── router.ts       # Router mocks
│   └── reactQuery.ts   # Query client for tests
├── fixtures/           # API response fixtures
├── factories/          # Test data factories
├── setup/              # Test environment setup
└── index.ts            # Central exports
```

**Rules:**

- ✅ Import from `@/test` in your tests
- ✅ Use `renderWithProviders` for all component tests
- ❌ Don't create one-off mocks inline — add to fixtures

## Anti-Patterns

| ❌ Don't                                | ✅ Do Instead                             |
| --------------------------------------- | ----------------------------------------- |
| Put components in `lib/`                | Use `components/` or `packages/ui`        |
| Import feature from feature             | Extract shared code to `lib/`             |
| Business logic in pages                 | Create hooks in `features/`               |
| Inline mock data in tests               | Use fixtures or factories                 |
| Create utils at repo root               | Put in `apps/web/src/lib/` or `packages/` |
| Random `.ts` files in `src/`            | Organize into appropriate directories     |
| Import `apps/web` from `apps/reference` | Consume workspace packages only           |

## Import Aliases

Each application has its own `@/*` alias. Neither app imports source from the other.

```typescript
// In apps/web or apps/reference
import { Button } from "@atlas/ui"; // UI package (public API only)
import { useUserList } from "@/features/users"; // Reference app feature hooks
import { apiGet } from "@/lib/api"; // Infrastructure
import { renderWithProviders } from "@/test"; // Test utilities
```

Configured per application in `tsconfig.json`:

```json
{
  "paths": {
    "@/*": ["./src/*"]
  }
}
```

```text
apps/web @/*           → apps/web/src/* only
apps/reference @/*     → apps/reference/src/* only
apps/web → apps/reference/src/**      forbidden
apps/reference → apps/web/src/**      forbidden
```

## Related

- [Architecture ownership](architecture-ownership.md)
- [API & data fetching](api.md)
