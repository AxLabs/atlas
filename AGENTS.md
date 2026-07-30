# Atlas — Agent Guide

Atlas is an enterprise-grade frontend platform monorepo (Next.js App Router, TypeScript, Tailwind
CSS, pnpm workspaces). It provides opinionated patterns for authentication, data fetching,
validation, theming, accessibility, and observability so product teams ship features without
reinventing infrastructure.

## Repository map

```
atlas/
├── apps/web/              # Next.js application (@atlas/web)
│   ├── src/app/           # Routes and layouts (thin — no business logic)
│   ├── src/features/      # Domain modules (queries, mutations, feature UI)
│   ├── src/components/    # App-level shared components
│   ├── src/lib/           # Infrastructure (api, auth, react-query, telemetry)
│   ├── src/providers/     # React context providers
│   ├── src/schemas/       # Zod validation schemas
│   └── e2e/               # Playwright tests
├── packages/ui/           # Reusable UI primitives (@atlas/ui)
├── packages/config/       # Shared ESLint, TypeScript, Jest, Prettier config
├── openapi/               # OpenAPI specification
└── docs/how-we-build/     # Canonical platform conventions
```

## Ownership boundaries

| Location                   | Owns                                                           | Does not own                              |
| -------------------------- | -------------------------------------------------------------- | ----------------------------------------- |
| `apps/web/src/app/`        | Routes, layouts, page composition                              | Business logic, reusable components       |
| `apps/web/src/features/`   | Domain logic, feature hooks, feature UI                        | Generic primitives, cross-feature imports |
| `apps/web/src/components/` | App-specific compositions                                      | Generic design-system components          |
| `packages/ui/`             | Reusable visual primitives, form helpers, app-state components | Product/domain logic, API calls           |
| `packages/config/`         | Tooling configuration                                          | Application or product code               |
| `apps/web/src/lib/`        | Shared infrastructure                                          | UI components, domain logic               |

Do not move code into a shared package unless it is genuinely reusable across applications. Prefer
existing Atlas components and patterns over new abstractions.

## Feature architecture

1. **Route** — Add a thin page under `apps/web/src/app/` that composes feature components.
2. **Feature module** — Create `apps/web/src/features/<name>/` with:
   - `keys.ts` — query key factory via `createQueryKeys` from `@/lib/react-query`
   - `queries.ts` / `mutations.ts` (or `hooks.ts` for smaller features)
   - `components/` — feature-specific UI
   - `index.ts` — public exports only
3. **No cross-feature imports** — extract shared logic to `lib/` if needed.

Reference implementations: `apps/web/src/features/users/` (OpenAPI client),
`apps/web/src/features/examples/` (app-route mocks).

## API and server-state architecture

- **Client data** — React Query hooks in feature modules; never call `fetch()` from pages,
  components, features, or providers (ESLint enforced).
- **Typed client** — Prefer `api` from `@/lib/api/contracts` for OpenAPI-backed endpoints; use
  `apiGet` / `apiPost` / `apiPatch` / `apiPut` / `apiDelete` from `@/lib/api` for app routes or
  bespoke endpoints.
- **Errors** — Wrap failures with `normalizeApiError`; display with `getUserFacingMessage` from
  `@/lib/api`.
- **Server components / route handlers** — Use `apiRequest` from `@/lib/api/server` for outbound
  calls. Route handlers (`src/app/api/**/route.ts`) are API boundaries where `fetch()` is permitted.
- **Types** — Import from `@/lib/api/contracts` (`components`, `paths` schemas). Regenerate after
  spec changes: `pnpm --filter @atlas/web api:gen`.
- **Notifications** — Use `notify` / `notifyApiError` from `@/lib/notifications` for toasts.

## Form and validation architecture

- **Schema** — Define Zod schemas in the feature or `apps/web/src/schemas/`; align client rules with
  server validation.
- **Form setup** — `useZodForm` from `@atlas/ui` with React Hook Form.
- **Fields** — `Form`, `FormField`, `FormLabel`, `FormControl`, `FormMessage` from `@atlas/ui`.
- **Server errors** — `applyServerFieldErrors(form, error)` first; fall back to
  `getFormErrorMessage`.
- **Submission** — Disable submit while `mutation.isPending`; show success via `notify` and/or
  navigation.

See `apps/web/src/app/examples/form/page.tsx`.

## UI-state handling

- **Server/async data** — React Query (`isLoading`, `isError`, `data`, `refetch`).
- **Interface states** — Use `@atlas/ui` primitives: `Skeleton` / `SkeletonList`, `EmptyState`,
  `ErrorFallback`, `Loader`.
- **Local UI state** — `useState` / `useReducer` for ephemeral UI (modals, tabs).
- **URL-driven state** — `useSearchParams` + `useRouter` when state should be bookmarkable (see
  `/examples/data?mode=`).
- **Auth** — `useSession` from `@/lib/auth` on the client; `readSession` from `@/lib/auth/session`
  on the server.
- **Config** — `useConfig()` (client) or `getServerConfig()` (server) from `@/config`; do not read
  `process.env` or import `@/env` in application code.

## Testing and validation

Before claiming completion, run the checks relevant to your change:

```bash
pnpm lint && pnpm typecheck && pnpm test    # minimum bar (matches CONTRIBUTING)
pnpm build                                  # when build-affecting
pnpm --filter @atlas/web test:e2e           # for user-facing flows
```

Unit tests: `renderWithProviders` from `@/test`, MSW for network mocking, query by role/label (not
test IDs first). Shared package code (`packages/ui`) requires tests.

Scoped commands:

```bash
pnpm --filter @atlas/web lint
pnpm --filter @atlas/web test -- path/to/file.test.tsx
pnpm format:write                           # fix formatting
```

## Prohibited patterns

- Raw `fetch()` in UI layers (use `@/lib/api`)
- Direct `process.env` or `@/env` imports in app/features/components/providers/lib
- Direct `posthog-js` imports (use `@/lib/analytics`)
- `console.*` in source (use structured logging on the server)
- Hand-written API types when OpenAPI types exist
- Inline query key strings (use key factories)
- Business logic in `app/` pages
- Feature-to-feature imports
- Premature extraction to `packages/ui`
- Installing dependencies without clear need
- Changing shared infrastructure to solve a local product problem

## Documentation and examples

| Topic                   | Location                                                                       |
| ----------------------- | ------------------------------------------------------------------------------ |
| Platform conventions    | [docs/how-we-build/README.md](docs/how-we-build/README.md)                     |
| Folder structure        | [docs/how-we-build/folder-structure.md](docs/how-we-build/folder-structure.md) |
| API & React Query       | [docs/how-we-build/api.md](docs/how-we-build/api.md)                           |
| Environment variables   | [docs/how-we-build/env.md](docs/how-we-build/env.md)                           |
| Testing                 | [docs/how-we-build/testing.md](docs/how-we-build/testing.md)                   |
| Continuous Integration  | [docs/how-we-build/ci.md](docs/how-we-build/ci.md)                             |
| Accessibility           | [docs/how-we-build/accessibility.md](docs/how-we-build/accessibility.md)       |
| Example patterns        | [docs/how-we-build/examples.md](docs/how-we-build/examples.md)                 |
| Architecture decisions  | [docs/adr/README.md](docs/adr/README.md)                                       |
| Canonical imports       | [docs/audit/atlas-consistency-audit.md](docs/audit/atlas-consistency-audit.md) |
| Data states example     | `apps/web/src/app/examples/data/page.tsx`                                      |
| Form example            | `apps/web/src/app/examples/form/page.tsx`                                      |
| Users feature (OpenAPI) | `apps/web/src/features/users/`                                                 |
