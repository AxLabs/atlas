# Atlas — Agent Guide

Atlas is a forkable frontend platform template monorepo (Next.js App Router, TypeScript, Tailwind
CSS, pnpm workspaces) for selected clients and authorized evaluators. It provides opinionated
patterns for authentication, data fetching, validation, theming, accessibility, and observability so
product teams ship features without reinventing infrastructure.

## Repository map

```
atlas/
├── apps/web/              # Next.js application (@atlas/web)
│   ├── src/app/           # Routes and layouts (thin — no business logic)
│   ├── src/features/      # Domain modules (queries, mutations, feature UI)
│   │   ├── reference/     # Reference-only hook patterns (safe to delete)
│   │   └── examples/      # Reference hooks for /examples routes
│   ├── src/components/    # App-level shared components
│   ├── src/lib/           # Infrastructure (api, auth, react-query, telemetry)
│   ├── src/providers/     # React context providers
│   ├── src/schemas/       # Zod validation schemas
│   └── e2e/               # Playwright tests
├── packages/ui/           # Reusable UI primitives (@atlas/ui)
├── packages/project/      # Atlas architecture contract loader (@atlas/project)
├── packages/cli/          # Atlas CLI (@atlas/cli)
├── packages/config/       # Shared ESLint, TypeScript, Jest, Prettier config
├── atlas.config.json      # Machine-readable project architecture (author contract)
├── openapi/               # OpenAPI specification
└── docs/how-we-build/     # Canonical platform conventions
```

## Ownership boundaries

| Location                       | Owns                                                           | Does not own                              |
| ------------------------------ | -------------------------------------------------------------- | ----------------------------------------- |
| `apps/web/src/app/`            | Routes, layouts, page composition                              | Business logic, reusable components       |
| `apps/web/src/features/`       | Domain logic, feature hooks, feature UI                        | Generic primitives, cross-feature imports |
| `apps/web/src/features/`       | Domain logic, feature hooks, feature UI (starter)              | Generic primitives, cross-feature imports |
| `apps/reference/`              | Executable reference application                               | Product features importing reference code |
| `apps/reference/src/features/` | Reference product features (users CRUD, harness UI)            | Starter app code                          |
| `apps/web/src/components/`     | App-specific compositions                                      | Generic design-system components          |
| `packages/ui/`                 | Reusable visual primitives, form helpers, app-state components | Product/domain logic, API calls           |
| `packages/config/`             | Tooling configuration                                          | Application or product code               |
| `apps/web/src/lib/`            | Shared infrastructure                                          | UI components, domain logic               |

Do not move code into a shared package unless it is genuinely reusable across applications. Prefer
existing Atlas components and patterns over new abstractions.

## Machine-readable architecture

The canonical machine-readable project architecture lives in **`atlas.config.json`** at the
repository root. Load and resolve it with **`@atlas/project`** — do not infer core structure from
Cursor rules, scattered config files, or directory guesses when the contract provides the answer.

- **Author contract:** `atlas.config.json` (minimal; defaults apply for omitted fields)
- **Resolved architecture:** `resolveAtlasProject(repoRoot)` → deterministic JSON via
  `serializeResolvedAtlasProject()`
- **Human context:** [architecture ownership](docs/how-we-build/architecture-ownership.md), ADRs,
  and this guide explain _why_; the contract states _what_ tooling-relevant architecture this
  project uses

See [Atlas project contract](docs/how-we-build/atlas-contract.md).

## Atlas CLI

Use the **`atlas`** binary for Atlas-owned workflows when a command exists (bootstrap, generators,
Doctor, migrations). Architecture context still comes from `@atlas/project` / `atlas.config.json` —
do not invent CLI commands that are not implemented.

| Use `atlas` for          | Use pnpm / Next / Turbo / Git directly for            |
| ------------------------ | ----------------------------------------------------- |
| `atlas init`             | `pnpm install`, `pnpm dev`, `pnpm test`, `pnpm build` |
| `atlas generate …`       | ESLint, TypeScript, Changesets, shadcn                |
| Contract-aware bootstrap | Manual boilerplate for supported generator shapes     |

When creating a new Atlas **product feature** or **App Router page**, prefer `atlas generate` where
its supported shape applies. Do not manually recreate generator-owned structural boilerplate unless
the generator cannot represent the required shape or you are modifying existing code.

Repository-local invocation: `pnpm atlas --help`. See [Atlas CLI](docs/how-we-build/cli.md).

## Feature architecture

1. **Route** — Add a thin page under `apps/web/src/app/` that composes feature components. Prefer
   `atlas generate page <route>` for new static route shells.
2. **Feature module** — Prefer `atlas generate feature <name>` for new product feature structure,
   then add:
   - `keys.ts` — query key factory via `createQueryKeys` from `@/lib/react-query`
   - `queries.ts` / `mutations.ts` (or `hooks.ts` for smaller features)
   - `components/` — feature-specific UI
   - `index.ts` — public exports only
3. **No cross-feature imports** — extract shared logic to `lib/` if needed.

Reference implementations: `apps/reference/` (executable reference application),
`apps/web/src/features/examples/` (app-route mocks). See
[architecture ownership](docs/how-we-build/architecture-ownership.md).

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
  spec changes: `pnpm api:gen` (regenerates both `apps/web` and `apps/reference` schemas).
- **Notifications** — Use `notify` / `notifyApiError` from `@/lib/notifications` for toasts.

## Authorization architecture

- **Permissions** — Use typed `permissions` from `@/lib/authz`; never scatter permission string
  literals or check reference roles directly in product code.
- **Server enforcement** — `requirePermission` for global capabilities; `requireResourcePermission`
  when a consumer resource policy may further restrict access. Import from `@/lib/application/authz`
  in route handlers, server components, and server actions. Distinguish 401 (unauthenticated) from
  403 (forbidden).
- **Resolver setup** — Permission resolvers and resource policies register in application
  composition (`lib/application/authz.ts` via `ensureApplicationAuthzConfigured()`). Do not import
  reference authz adapters into core authz; do not register authz adapters from feature routes or
  route handlers.
- **Reference mode** — Reference resolver and resource policy register only when reference mode is
  enabled (`isReferenceModeEnabled()`). Reference policies are scoped to reference principals.
- **Client gating** — `Can`, `usePermission`, and `hasClientPermission` from `@/lib/authz` for
  presentation only — **not a security boundary**. Pass `grantedPermissions` from an existing
  `useSession()` call when possible. Every protected action must also enforce on the server.
- **Roles** — Reference profile metadata maps to permissions via
  `lib/reference/auth/permissions.ts`. Roles are not part of the core `OAuthUser` contract.
- **Backend** — Real backends remain authoritative for data protection; Atlas frontend checks are UX
  and route-level enforcement only.

See [authorization](docs/how-we-build/authorization.md).

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

## UI foundation (shadcn preset)

`@atlas/ui` is Atlas's governed UI boundary — not a proprietary component library. The default
visual baseline is a reproducible stock shadcn preset:

**Base UI + Vega + Neutral + Blue + Neutral charts + Inter + Lucide + default radius + default/solid
menu + subtle menu accent**

Preset code: `bJzBPQGZc` — verify with `pnpm dlx shadcn@latest preset decode bJzBPQGZc --json`.

For upstream-derived primitives, **shadcn-generated styling wins**. Do not casually edit component
CSS in `packages/ui/src/components/ui/**`; change the preset deliberately or compose in application
code. Canonical shadcn config is `packages/ui/components.json` — generate primitives into
`packages/ui` only; apps consume `@atlas/ui` public exports. See `packages/ui/README.md`.

- **Primitive usage** — Use `@atlas/ui` Storybook stories as the local canonical reference for
  shadcn/Base UI primitives; preserve upstream defaults unless the product deliberately overrides.
  See `packages/ui/README.md` for component-specific traps (e.g. `Select` `items` for value/label
  resolution).

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
pnpm --filter @atlas/cli build && pnpm atlas doctor   # after architecture-sensitive changes
pnpm lint && pnpm typecheck && pnpm test                # minimum bar (matches CONTRIBUTING.md)
pnpm docs:check                                       # when changing documentation links
pnpm governance:check                                 # when changing release/licensing policy
pnpm build                                            # when build-affecting
pnpm --filter @atlas/web test:e2e                     # for user-facing flows
```

`atlas doctor` validates Atlas-specific contract and architecture drift. It does not replace lint,
typecheck, or tests. Treat Doctor error diagnostics as architectural failures and follow the
suggested remediation rather than suppressing checks.

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
- Checking reference roles directly in product code (use typed permissions from `@/lib/authz`)
- Business logic in `app/` pages
- Feature-to-feature imports
- Premature extraction to `packages/ui`
- Installing dependencies without clear need
- Changing shared infrastructure to solve a local product problem

## Documentation and examples

| Topic                   | Location                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| Architecture ownership  | [docs/how-we-build/architecture-ownership.md](docs/how-we-build/architecture-ownership.md)   |
| Upgrades                | [docs/how-we-build/upgrades.md](docs/how-we-build/upgrades.md)                               |
| Authorization           | [docs/how-we-build/authorization.md](docs/how-we-build/authorization.md)                     |
| Atlas project contract  | [docs/how-we-build/atlas-contract.md](docs/how-we-build/atlas-contract.md)                   |
| Platform conventions    | [docs/how-we-build/README.md](docs/how-we-build/README.md)                                   |
| Folder structure        | [docs/how-we-build/folder-structure.md](docs/how-we-build/folder-structure.md)               |
| API & React Query       | [docs/how-we-build/api.md](docs/how-we-build/api.md)                                         |
| Environment variables   | [docs/how-we-build/env.md](docs/how-we-build/env.md)                                         |
| Testing                 | [docs/how-we-build/testing.md](docs/how-we-build/testing.md)                                 |
| Continuous Integration  | [docs/how-we-build/ci.md](docs/how-we-build/ci.md)                                           |
| Releases & governance   | [docs/how-we-build/releases-and-governance.md](docs/how-we-build/releases-and-governance.md) |
| Accessibility           | [docs/how-we-build/accessibility.md](docs/how-we-build/accessibility.md)                     |
| Example patterns        | [docs/how-we-build/examples.md](docs/how-we-build/examples.md)                               |
| Architecture decisions  | [docs/adr/README.md](docs/adr/README.md)                                                     |
| Canonical imports       | [docs/audit/atlas-consistency-audit.md](docs/audit/atlas-consistency-audit.md)               |
| Claims register         | [docs/audit/claims-register.md](docs/audit/claims-register.md)                               |
| Contributing            | [CONTRIBUTING.md](CONTRIBUTING.md)                                                           |
| Data states example     | `apps/web/src/app/examples/data/page.tsx`                                                    |
| Form example            | `apps/web/src/app/examples/form/page.tsx`                                                    |
| OpenAPI reference hooks | `apps/reference/src/features/users/`                                                         |
