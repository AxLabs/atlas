# Architecture Ownership

> **Canonical classification of what Atlas owns, what is reference-only, and what consumers own.**

This document is the single source of truth for architecture ownership in Atlas. It answers: _what
is platform infrastructure, what demonstrates a pattern, what is generated, and what should a
consumer keep, replace, or delete?_

For runtime design (layers, data flow, auth sequence), see
[public architecture](../public/architecture.md).

---

## Classification model

| Classification         | Meaning                                                 | Consumer action                      |
| ---------------------- | ------------------------------------------------------- | ------------------------------------ |
| **Core platform**      | Reusable infrastructure Atlas establishes as convention | Keep; extend via adapters and config |
| **App-owned**          | Reference app wiring and composition                    | Replace with your product shell      |
| **Reference**          | Demonstrates a pattern; no product UI                   | Copy, adapt, or delete               |
| **Generated**          | Machine-owned from OpenAPI or tooling                   | Regenerate; never hand-edit          |
| **Documentation only** | Conventions without executable code                     | Follow when building                 |
| **Removed**            | Dead or unjustified surface                             | Already deleted or not shipped       |

---

## Classification table

| Surface                                     | Current state                                     | Classification            | Decision    | Reason                                                                          |
| ------------------------------------------- | ------------------------------------------------- | ------------------------- | ----------- | ------------------------------------------------------------------------------- |
| `lib/api` (client, errors, correlation)     | Central HTTP gateway, ESLint-enforced             | Core platform             | Keep        | Establishes no-fetch-spaghetti, error normalization, correlation IDs            |
| `lib/api/contracts`                         | OpenAPI-generated types + typed client            | Generated + core platform | Keep        | Contract-first data fetching (ADR-0003)                                         |
| `lib/react-query`                           | Provider, `createQueryKeys`, patterns doc         | Core platform             | Keep        | Standard cache key factory; patterns.ts is reference documentation              |
| `lib/auth` (session, PKCE, state, types)    | Encrypted httpOnly session storage                | Core platform             | Keep        | Provider-neutral session security machinery                                     |
| `lib/auth/providers/google`                 | Google OAuth code exchange                        | Reference                 | Demonstrate | Google is one reference IdP, not the universal Atlas auth model                 |
| `lib/auth/providers/google/session-refresh` | Google refresh orchestration for session cookies  | Reference                 | Demonstrate | Composes Google refresh with core session primitives                            |
| `app/api/auth/google/*`                     | OAuth start/callback routes                       | Reference                 | Demonstrate | Replace with consumer's IdP routes                                              |
| `components/reference/auth`                 | SignInButton, UserMenu, AuthGuard                 | Reference                 | Demonstrate | Not mounted; Google-specific UI for #39                                         |
| `features/reference/users`                  | OpenAPI React Query hooks + reference app UI      | Reference                 | Keep        | Canonical typed-resource pattern for future generators                          |
| `features/examples`                         | Hooks for mock app routes                         | Reference                 | Keep        | Demonstrates app-route API pattern                                              |
| `app/examples/**`                           | Data/form demo pages + ExamplesShell              | Reference                 | Keep        | Minimal live demos; delete when building product                                |
| `app/api/examples/**`                       | In-memory mock APIs                               | Reference                 | Keep        | Supports examples only; delete with examples                                    |
| `lib/feature-flags`                         | Typed flags, provider, default adapter, guards    | Core platform             | Keep        | Runtime config + kill-switch convention; PostHog adapter is optional reference  |
| `app/__flags`                               | Dev-only flag override panel                      | Reference                 | Keep        | Development tooling, not product                                                |
| `lib/i18n`                                  | `t()` with English-only strings                   | Core platform (minimal)   | Simplify    | Typed key convention for shared strings; not a localization framework           |
| `lib/analytics`                             | Typed event map, adapter interface, noop fallback | Core platform             | Keep        | Consent-gated analytics contract; adapters are swappable                        |
| `lib/analytics/adapters/*`                  | PostHog, GA implementations                       | Reference integrations    | Keep        | Vendor-specific; replace or remove per consumer                                 |
| `lib/consent/config`                        | Maps app config → `@atlas/consent`                | App-owned glue            | Keep        | Thin bridge; consent UI lives in package                                        |
| `@atlas/consent`                            | Cookie consent provider + banner                  | Core platform package     | Keep        | Optional but first-class when analytics enabled (ADR-0006)                      |
| `lib/telemetry` (web vitals)                | Client reporting + API route                      | Core platform             | Keep        | Opt-in performance telemetry convention                                         |
| Root `sentry.*.config.ts`                   | Sentry SDK initialization                         | Core platform             | Keep        | Observability at Next.js integration boundary (ADR-0005)                        |
| `lib/telemetry/sentry.*`                    | Duplicate Sentry wrappers                         | Removed                   | Remove      | Duplicated root Sentry setup; deleted                                           |
| `lib/notifications`                         | Sonner wrapper + `notifyApiError`                 | Core platform             | Keep        | Toast convention integrated with i18n and ApiError                              |
| `lib/breadcrumbs`                           | Tree builder + `useBreadcrumbs`                   | Core platform             | Keep        | Route-aware breadcrumb convention; tree is reference data                       |
| `components/navigation/AppBreadcrumbs`      | Breadcrumb UI wired to lib                        | App-owned composition     | Keep        | Used by ExamplesShell; consumers relocate or replace                            |
| `components/layout/AppShell`                | Generic shell with slots                          | Removed                   | Remove      | Unused aspirational scaffold; reference app owns its shell in #39               |
| `components/errors/ErrorBoundary`           | Class error boundary                              | Removed                   | Remove      | Unused; Sentry + global-error handle failures                                   |
| `providers/*`                               | MainProvider stack, DataProviderLayout            | App-owned composition     | Keep        | Wires platform modules; see `providers/README.md`                               |
| `@atlas/ui`                                 | shadcn/Base UI preset + behavioral helpers        | Core platform package     | Keep        | Governed UI foundation; shadcn/Base UI visual baseline + Atlas helpers          |
| `@atlas/config`                             | ESLint, TS, Jest, Prettier configs                | Core platform package     | Keep        | Tooling boundary for monorepo consistency                                       |
| `packages/ui` shadcn primitives             | Base UI/Vega preset-generated building blocks     | Upstream-derived          | Keep        | Regenerate from `packages/ui/components.json`; Atlas owns behavior, not styling |
| OpenAPI `schema.ts`                         | Generated from `openapi/openapi.json`             | Generated                 | Keep        | Regenerate via `pnpm --filter @atlas/web api:gen`                               |

---

## What is Atlas?

Atlas is a **frontend platform template** — not a product. It owns:

1. **Infrastructure conventions** in `apps/web/src/lib/` — API client, auth session contract, React
   Query patterns, feature flags, analytics/consent contracts, telemetry, notifications.
2. **Workspace packages** — `@atlas/ui` (visual foundation), `@atlas/consent` (consent UI),
   `@atlas/config` (tooling).
3. **Architectural enforcement** — ESLint rules (no raw `fetch`, no `process.env` in app code, no
   vendor SDK bypass), typed config facade, OpenAPI contract generation.
4. **Reference patterns** — minimal `/examples` routes and hook-level references that teach the
   conventions without pretending to be a product.

Atlas does **not** own: backend architecture, domain features, vendor choice (beyond reference
adapters), or consumer deployment infrastructure.

The monorepo contains two applications:

| Application          | Purpose                                                                   |
| -------------------- | ------------------------------------------------------------------------- |
| **`apps/web`**       | Clean Atlas starter for consumer product development                      |
| **`apps/reference`** | Executable reference product demonstrating Atlas architecture in practice |

`apps/web` keeps minimal `/examples` routes for isolated pattern showcases (data states, forms). The
coherent reference product (users CRUD, harness, authz demos) lives entirely in `apps/reference`.

---

## What is the reference implementation?

Reference code exists to **teach patterns**, not to ship as product functionality.

| Location                                       | Demonstrates                                    | Safe to delete?                |
| ---------------------------------------------- | ----------------------------------------------- | ------------------------------ | ---- | ---------------------------------------------- |
| `app/examples/**`                              | Data states, forms, ExamplesShell layout        | Reference                      | Keep | Starter app only; delete when building product |
| `apps/reference/**`                            | Coherent reference application + harness        | Reference                      | Keep | Separate workspace app; optional in forks      |
| `features/examples/`                           | React Query hooks against app routes            | Reference                      | Keep | Starter app only; with examples                |
| `apps/reference/src/features/users/`           | OpenAPI typed-resource hooks + reference app UI | Reference                      | Keep | Canonical product pattern in reference app     |
| `app/api/examples/**`                          | Mock in-memory APIs                             | Yes — with examples            |
| `components/reference/auth/`                   | Google OAuth UI wiring                          | Yes — replace with your IdP UI |
| `app/api/auth/google/**`                       | Google OAuth flow                               | Yes — replace with your IdP    |
| `app/__flags`                                  | Feature flag dev panel                          | Yes — dev-only                 |
| `lib/react-query/patterns.ts`                  | Mutation/query factory helpers                  | Yes — optional pattern         |
| `lib/feature-flags/adapters/posthogAdapter.ts` | PostHog flag adapter                            | Yes — if not using PostHog     |

The coherent reference application under `/reference` demonstrates end-to-end Atlas composition.
`/examples` and `features/reference/` hooks remain available as isolated pattern references.

---

## What belongs to the consumer?

When forking Atlas, consumers own and replace:

- **Product features** under `features/` (except `reference/` and `examples/`)
- **Routes and pages** under `app/` (except examples and platform API routes they choose to keep)
- **App shell and navigation** — `ExamplesShell` is reference; build your own layout
- **Provider composition** — rearrange `providers/` for your product
- **Identity provider** — Google OAuth is reference; wire your IdP
- **Analytics vendor** — swap or remove PostHog/GA adapters
- **Breadcrumb tree** — extend `lib/breadcrumbs/tree.ts` for your routes
- **Feature flag keys** — define your own in `lib/feature-flags/flags.ts`
- **OpenAPI spec** — replace `openapi/openapi.json` with your API contract
- **Environment and deployment** — your infrastructure, not Atlas's

---

## What is generated?

| Artifact                      | Source                                   | Regenerate                         | Do not edit                          |
| ----------------------------- | ---------------------------------------- | ---------------------------------- | ------------------------------------ |
| `lib/api/contracts/schema.ts` | `openapi/openapi.json`                   | `pnpm --filter @atlas/web api:gen` | Yes                                  |
| `lib/api/contracts/index.ts`  | Hand-maintained typed client over schema | Update when adding API resources   | Partially — client layer is platform |

Generated code is **machine-owned**. Platform code wraps it (`contracts/index.ts`, feature hooks).
Consumer code imports types and the typed client — never duplicates schema shapes by hand.

---

## Package boundaries

### `@atlas/ui`

`@atlas/ui` is Atlas's **governed UI foundation** — not a proprietary design system. shadcn/Base UI
provides the primitive implementation and visual baseline; Atlas owns architecture, package
boundaries, behavioral helpers, and conventions.

| Owns                                                             | Does not own                             |
| ---------------------------------------------------------------- | ---------------------------------------- |
| shadcn/Base UI preset-generated primitives (Vega/Blue/Inter)     | Product/domain logic                     |
| Form helpers (`useZodForm`, server error mapping)                | API calls                                |
| App-state compositions (EmptyState, ErrorFallback, SkeletonList) | Broad application composition catalog    |
| Theme preference provider and boot script (not visual tokens)    | Competing upstream styling or primitives |

**Preset:** `bJzBPQGZc` — Base UI + Vega + Neutral + Blue + Neutral charts + Inter + Lucide. See
`packages/ui/README.md`.

**Generation flow:** `packages/ui/components.json` → `packages/ui/src/components/ui` → `@atlas/ui`
public exports → `apps/web`. `apps/web/components.json` does not exist and must not be recreated as
an app-local primitive generation target. Run shadcn generation against `packages/ui` only.

**Public API:** `import { Button } from "@atlas/ui"` and documented subpaths (`globals.css`,
`theme-boot`, `extended`). Do not import from `packages/ui/src/**` — ESLint enforces this.

Heavy optional primitives with substantial runtime dependencies are exported from
`@atlas/ui/extended`; the default barrel contains the commonly used foundation surface.

**Styling rule:** upstream primitive appearance comes from current shadcn generation; Atlas owns
behavioral wrappers and monorepo integration only. Reusable application compositions should be
extracted only after #39 proves them in a coherent reference application.

### `@atlas/consent`

| Owns                               | Does not own             |
| ---------------------------------- | ------------------------ |
| Cookie consent banner and provider | Analytics implementation |
| Consent state persistence          | App configuration values |

**Public API:** `import { ConsentProvider, useConsent } from "@atlas/consent"`.

### `@atlas/config`

| Owns                                              | Does not own     |
| ------------------------------------------------- | ---------------- |
| Shared ESLint, TypeScript, Jest, Prettier configs | Application code |

**Public API:** `@atlas/config/eslint`, `@atlas/config/typescript`, etc.

### `apps/web` (`@atlas/web`)

The reference application. Owns route composition, provider wiring, and reference examples. Not
published as a library — forked and replaced by consumers.

---

## Import boundaries

```text
apps/web @/*           → apps/web/src/* only
packages/ui internals  → package-local / relative imports
apps/web consumption   → @atlas/ui public exports
```

1. **App → package:** Use public exports only (`@atlas/ui`, `@atlas/consent`).
2. **Package → app:** Never. Packages do not import consumer code.
3. **Feature → feature:** Never. Extract shared logic to `lib/`.
4. **Reference → product:** Never. Reference modules are not imported by product features.
5. **No `@/*` bypass to package source:** The `@/*` alias resolves to `apps/web/src/*` only.
6. **No app resolution of package internals:** `apps/web` must not resolve or import
   `packages/ui/src/**` through TypeScript aliases. `@atlas/ui` is consumed through its public
   package exports. Package-internal shadcn imports are relative/package-local so the UI package
   resolves independently.

ESLint guards in `apps/web/eslint.config.mjs` enforce fetch, env, analytics SDK, package source
import, and UI-internal alias rules.

---

## Deferred to future issues

The canonical shadcn/Base UI foundation (#42) is complete. Remaining roadmap ownership:

| Issue   | Scope intentionally not in this document's implementation |
| ------- | --------------------------------------------------------- |
| #16     | Storybook, a11y, and visual-regression hardening          |
| #43–#44 | Migration framework, agent workflow redesign              |

Reusable application compositions should be extracted to shared packages only when proven across
independent reference surfaces — see the #39 composition promotion audit.

---

## Related docs

- [Folder structure](folder-structure.md) — where code lives
- [Atlas project contract](atlas-contract.md) — machine-readable architecture for tooling
- [API & data fetching](api.md) — client and contract usage
- [Reference examples](examples.md) — `/examples` routes
- [ADR-0007: Architecture ownership model](../adr/0007-architecture-ownership-model.md)
