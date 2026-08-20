# Folder Structure

> Where code lives and why.

## Monorepo Layout

```
atlas/
├── apps/
│   └── web/                    # Next.js App Router application
│       ├── src/
│       │   ├── app/            # Next.js App Router pages & routes
│       │   ├── components/     # Shared app-level components
│       │   ├── features/       # Feature modules (domain logic)
│       │   ├── lib/            # Shared utilities & infrastructure
│       │   ├── providers/      # React context providers
│       │   ├── schemas/        # Zod validation schemas
│       │   ├── env/            # Environment variable exports
│       │   ├── test/           # Test utilities, fixtures, factories
│       │   └── types/          # Shared TypeScript types
│       ├── e2e/                # Playwright E2E tests
│       └── scripts/            # Build & validation scripts
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

## Key Directories Explained

### `apps/web/src/app/`

Next.js App Router pages and API routes.

```
app/
├── examples/           # Reference patterns (delete when building product)
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

### `apps/web/src/features/`

Feature modules contain domain-specific code.

```
features/
├── examples/           # Reference hooks for mock app routes (delete with /examples)
├── reference/          # Reference-only patterns (safe to delete)
│   └── users/          # OpenAPI client reference hooks (no UI)
│       ├── keys.ts
│       ├── queries.ts
│       ├── mutations.ts
│       └── index.ts
```

**Rules:**

- ✅ Each product feature is self-contained under `features/<name>/`
- ✅ Reference modules live under `features/reference/` — not imported by product features
- ✅ Export only public API from `index.ts`
- ✅ Keep query/mutation logic in feature, not in components
- ❌ Features should not import from other features directly
- ❌ Don't put shared utilities here — use `lib/`

See [architecture ownership](architecture-ownership.md) for the full classification.

### `apps/web/src/lib/`

Shared infrastructure and utilities.

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
├── reference/          # Reference UI patterns (not mounted in app)
│   └── auth/           # Google OAuth UI components
└── ...
```

**Rules:**

- ✅ Components that are specific to the web app
- ✅ Components that compose UI package primitives
- ✅ `reference/` — pattern demonstrations; safe to delete or replace
- ❌ Generic/reusable components go in `packages/ui`
- ❌ Do not treat reference components as platform primitives

### `packages/ui/`

Shared UI component library.

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

| ❌ Don't                     | ✅ Do Instead                             |
| ---------------------------- | ----------------------------------------- |
| Put components in `lib/`     | Use `components/` or `packages/ui`        |
| Import feature from feature  | Extract shared code to `lib/`             |
| Business logic in pages      | Create hooks in `features/`               |
| Inline mock data in tests    | Use fixtures or factories                 |
| Create utils at repo root    | Put in `apps/web/src/lib/` or `packages/` |
| Random `.ts` files in `src/` | Organize into appropriate directories     |

## Import Aliases

```typescript
// In apps/web
import { Button } from "@atlas/ui"; // UI package (public API only)
import { useUserList } from "@/features/reference/users"; // Reference OpenAPI hooks
import { apiGet } from "@/lib/api"; // Infrastructure
import { renderWithProviders } from "@/test"; // Test utilities
```

Configured in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@/lib/*": ["./src/lib/*", "../../packages/ui/src/lib/*"]
    }
  }
}
```

The `@/lib/*` secondary fallback is a **TypeScript resolution shim** for `@atlas/ui` source — not an
app import path. ESLint bans app code from importing `@/lib/utils` etc.; use `@atlas/ui` instead.
See [architecture ownership](architecture-ownership.md#import-boundaries).
