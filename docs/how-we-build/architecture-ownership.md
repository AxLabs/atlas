# Architecture Ownership

> **Canonical classification of what Atlas owns, what is reference-only, and what consumers own.**

This document is the single source of truth for architecture ownership in Atlas. It answers: _what
is platform infrastructure, what demonstrates a pattern, what is generated, and what should a
consumer keep, replace, or delete?_

For runtime design (layers, data flow, auth sequence), see
[public architecture](../public/architecture.md).

---

## Classification model

Atlas uses four primary classifications for application code. Use these terms consistently across
docs, tooling, and reviews.

| Classification                | Meaning                                                                                | Consumer action                              |
| ----------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------- |
| **Core platform**             | Conventions and infrastructure shipped in the starter (`lib/`, packages)               | Keep; extend via adapters and config         |
| **Starter reference/example** | Small isolated teaching examples inside `apps/web` (`/examples`, `features/examples/`) | Copy, adapt, or delete when building product |
| **Reference application**     | Complete executable example in `apps/reference`                                        | Keep, study, or remove the entire workspace  |
| **App-owned**                 | Product composition consumers replace with their own shell and features                | Replace with your product                    |

Additional cross-cutting classifications:

| Classification         | Meaning                               | Consumer action                |
| ---------------------- | ------------------------------------- | ------------------------------ |
| **Generated**          | Machine-owned from OpenAPI or tooling | Regenerate; never hand-edit    |
| **Documentation only** | Conventions without executable code   | Follow when building           |
| **Removed**            | Dead or unjustified surface           | Already deleted or not shipped |

---

## Monorepo applications

The monorepo contains two independent Next.js applications:

| Application          | Classification         | Purpose                                                                   |
| -------------------- | ---------------------- | ------------------------------------------------------------------------- |
| **`apps/web`**       | Clean consumer starter | Atlas platform starter — demonstrates conventions without a fake product  |
| **`apps/reference`** | Reference application  | Executable reference product demonstrating Atlas architecture in practice |

`apps/web` keeps minimal `/examples` routes for isolated pattern showcases (data states, forms). The
coherent reference product (users CRUD, harness, authz demos) lives entirely in `apps/reference` at
routes such as `/`, `/users`, `/profile`, `/authorization`, and `/harness`.

Consumers can keep or remove the entire `apps/reference` workspace independently of `apps/web`.

---

## Classification table

Paths below use `apps/web/src/` unless noted. The reference application mirrors many of the same
`lib/` conventions under `apps/reference/src/`.

| Location                                    | Current state                                     | Classification            | Decision    | Reason                                                                          |
| ------------------------------------------- | ------------------------------------------------- | ------------------------- | ----------- | ------------------------------------------------------------------------------- |
| `lib/api` (client, errors, correlation)     | Central HTTP gateway, ESLint-enforced             | Core platform             | Keep        | Establishes no-fetch-spaghetti, error normalization, correlation IDs            |
| `lib/api/contracts`                         | OpenAPI-generated types + typed client            | Generated + core platform | Keep        | Contract-first data fetching (ADR-0003)                                         |
| `lib/react-query`                           | Provider, `createQueryKeys`, patterns doc         | Core platform             | Keep        | Standard cache key factory; patterns.ts is reference documentation              |
| `lib/auth` (session, PKCE, state, types)    | Encrypted httpOnly session storage                | Core platform             | Keep        | Provider-neutral session security machinery                                     |
| `lib/auth/providers/google`                 | Google OAuth code exchange                        | Starter reference         | Demonstrate | Google is one reference IdP, not the universal Atlas auth model                 |
| `lib/auth/providers/google/session-refresh` | Google refresh orchestration for session cookies  | Starter reference         | Demonstrate | Composes Google refresh with core session primitives                            |
| `app/api/auth/google/*`                     | OAuth start/callback routes                       | Starter reference         | Demonstrate | Replace with consumer's IdP routes                                              |
| `features/examples`                         | Hooks for mock app routes                         | Starter reference/example | Keep        | Demonstrates app-route API pattern                                              |
| `app/examples/**`                           | Data/form demo pages + ExamplesShell              | Starter reference/example | Keep        | Minimal live demos; delete when building product                                |
| `app/api/examples/**`                       | In-memory mock APIs                               | Starter reference/example | Keep        | Supports examples only; delete with examples                                    |
| `apps/reference/**`                         | Coherent reference application + harness          | Reference application     | Keep        | Separate workspace app; optional in forks                                       |
| `apps/reference/src/features/users/`        | OpenAPI typed-resource hooks + reference app UI   | Reference application     | Keep        | Canonical product pattern in reference app                                      |
| `lib/feature-flags`                         | Typed flags, provider, default adapter, guards    | Core platform             | Keep        | Runtime config + kill-switch convention; PostHog adapter is optional reference  |
| `app/__flags`                               | Dev-only flag override panel                      | Starter reference         | Keep        | Development tooling, not product                                                |
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
| `components/layout/AppShell`                | Generic shell with slots                          | Removed                   | Remove      | Unused aspirational scaffold; reference app owns its shell                      |
| `components/errors/ErrorBoundary`           | Class error boundary                              | Removed                   | Remove      | Unused; Sentry + global-error handle failures                                   |
| `providers/*`                               | MainProvider stack, DataProviderLayout            | App-owned composition     | Keep        | Wires platform modules; see `providers/README.md`                               |
| `@atlas/ui`                                 | shadcn/Base UI preset + behavioral helpers        | Core platform package     | Keep        | Governed UI foundation; shadcn/Base UI visual baseline + Atlas helpers          |
| `@atlas/config`                             | ESLint, TS, Jest, Prettier configs                | Core platform package     | Keep        | Tooling boundary for monorepo consistency                                       |
| `packages/ui` shadcn primitives             | Base UI/Vega preset-generated building blocks     | Upstream-derived          | Keep        | Regenerate from `packages/ui/components.json`; Atlas owns behavior, not styling |
| OpenAPI `schema.ts` (per app)               | Generated from `openapi/openapi.json`             | Generated                 | Keep        | Regenerate via root `pnpm api:gen`; CI enforces freshness via `pnpm api:check`  |

---

## What is Atlas?

Atlas is a **frontend platform template** — not a product. It owns:

1. **Infrastructure conventions** in each application's `src/lib/` — API client, auth session
   contract, React Query patterns, feature flags, analytics/consent contracts, telemetry,
   notifications.
2. **Workspace packages** — `@atlas/ui` (visual foundation), `@atlas/consent` (consent UI),
   `@atlas/config` (tooling).
3. **Architectural enforcement** — ESLint rules (no raw `fetch`, no `process.env` in app code, no
   vendor SDK bypass), typed config facade, OpenAPI contract generation.
4. **Starter reference/examples** — minimal `/examples` routes and hook-level examples in `apps/web`
   that teach conventions without pretending to be a product.
5. **Reference application** — `apps/reference` as an optional, executable end-to-end product
   journey for learning and evaluation.

Atlas does **not** own: backend architecture, domain features, vendor choice (beyond reference
adapters), or consumer deployment infrastructure.

---

## What is the reference implementation?

Reference code exists to **teach patterns** or **demonstrate a complete product journey** — not to
ship as mandatory consumer product functionality.

| Location                                       | Demonstrates                                    | Classification              | Safe to delete?                 |
| ---------------------------------------------- | ----------------------------------------------- | --------------------------- | ------------------------------- |
| `app/examples/**` (starter)                    | Data states, forms, ExamplesShell layout        | Starter reference/example   | Yes — when building product     |
| `features/examples/` (starter)                 | React Query hooks against app routes            | Starter reference/example   | Yes — with examples             |
| `apps/reference/**`                            | Coherent reference application + harness        | Reference application       | Yes — entire workspace optional |
| `apps/reference/src/features/users/`           | OpenAPI typed-resource hooks + reference app UI | Reference application       | Yes — with reference app        |
| `app/api/examples/**` (starter)                | Mock in-memory APIs                             | Starter reference/example   | Yes — with examples             |
| `app/api/auth/google/**` (starter)             | Google OAuth flow                               | Starter reference           | Yes — replace with your IdP     |
| `app/__flags` (starter)                        | Feature flag dev panel                          | Starter reference           | Yes — dev-only                  |
| `lib/react-query/patterns.ts`                  | Mutation/query factory helpers                  | Core platform documentation | Optional pattern                |
| `lib/feature-flags/adapters/posthogAdapter.ts` | PostHog flag adapter                            | Reference integration       | Yes — if not using PostHog      |

The reference application under `apps/reference` demonstrates end-to-end Atlas composition. Starter
`/examples` remain available as isolated pattern references inside `apps/web`.

---

## What belongs to the consumer?

When forking Atlas, consumers own and replace:

- **Product features** under `apps/web/src/features/*` (excluding `examples/`)
- **Routes and pages** under `apps/web/src/app/` (except examples and platform API routes they
  choose to keep)
- **App shell and navigation** — `ExamplesShell` is starter reference; build your own layout
- **Provider composition** — rearrange `providers/` for your product
- **Identity provider** — Google OAuth is reference; wire your IdP
- **Analytics vendor** — swap or remove PostHog/GA adapters
- **Breadcrumb tree** — extend `lib/breadcrumbs/tree.ts` for your routes
- **Feature flag keys** — define your own in `lib/feature-flags/flags.ts`
- **OpenAPI spec** — replace `openapi/openapi.json` with your API contract
- **Environment and deployment** — your infrastructure, not Atlas's
- **Reference application** — keep, study, or delete `apps/reference/` independently

`apps/web/src/features/*` holds consumer product features plus optional isolated examples.
`apps/reference/*` is an optional executable learning/evaluation application.

---

## What is generated?

| Artifact                      | Source                                   | Regenerate                       | Do not edit                          |
| ----------------------------- | ---------------------------------------- | -------------------------------- | ------------------------------------ |
| `lib/api/contracts/schema.ts` | `openapi/openapi.json`                   | Root `pnpm api:gen`              | Yes                                  |
| `lib/api/contracts/index.ts`  | Hand-maintained typed client over schema | Update when adding API resources | Partially — client layer is platform |

Both `apps/web` and `apps/reference` generate `src/lib/api/contracts/schema.ts` from the same
`openapi/openapi.json`. Root `pnpm api:gen` regenerates both copies; `pnpm api:check` in CI verifies
committed artifacts match the spec.

The Atlas project contract (`atlas.config.json` schema v1) identifies the **starter** application's
generated schema as the canonical contract artifact (`apps/web/src/lib/api/contracts/schema.ts`).
The reference application owns a second generated copy because it is an independent consumer
application. This is intentional — see [Atlas project contract](atlas-contract.md).

Generated code is **machine-owned**. Platform code wraps it (`contracts/index.ts`, feature hooks).
Consumer code imports types and the typed client — never duplicates schema shapes by hand.

---

## Duplicated starter/reference infrastructure

`apps/web/src/lib/*` and `apps/reference/src/lib/*` deliberately duplicate platform template
conventions (API client, auth, React Query, feature flags, telemetry, and related modules). Many
paths are byte-identical; others are application-owned wiring that intentionally diverges.

**Why:** `apps/reference` is intended to behave like an independent consumer application. It
demonstrates how the conventions present in the starter are composed into a finished product, rather
than importing application internals directly from `apps/web`.

**Risk:** Shared template conventions can drift between the starter and reference application.

**Synchronization model (ADR-0009):**

| Classification                 | Examples                                                                        | Update mechanism                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Generated artifact             | `lib/api/contracts/schema.ts`                                                   | `pnpm api:gen`, `pnpm api:check`, Doctor `generated-openapi` (not template-synced)                 |
| Synced template infrastructure | API client, auth session, React Query keys, security helpers                    | Canonical starter (`apps/web`); `atlas sync infrastructure`; Doctor `template-infrastructure-sync` |
| Application-owned wiring       | `lib/application/authz.ts`, `lib/breadcrumbs/tree.ts`, `lib/analytics/index.ts` | Edit per application; listed in manifest `independentPaths` (divergence allowed, not required)     |
| Reference harness              | `lib/reference/**`, reference auth providers                                    | Reference-only; manifest `referenceOnlyPaths`                                                      |
| Starter examples UI            | `components/LandingSelect.tsx`                                                  | Starter-only; manifest `starterOnlyPaths`                                                          |
| Shared workspace packages      | `@atlas/ui`, `@atlas/consent`, `@atlas/config`                                  | Package releases and semver                                                                        |

The manifest `templates/app-infrastructure.manifest.json` is the machine-readable policy for which
paths must stay aligned vs allowed to diverge. `generatedPaths` documents machine-generated
artifacts for ownership clarity; template sync does not copy them. Run `pnpm template:check` in CI
or locally to detect drift; run `pnpm template:sync` to copy canonical starter files into consumer
applications. Mutating sync re-validates after writes and exits successfully when repairable drift
is cleared.

When fixing platform infrastructure, prefer:

1. Shared package — only when external consumers would genuinely import it
2. Synced template path — stable conventions copied from `apps/web`
3. Generated artifact — OpenAPI and similar machine-owned outputs
4. Manual per-app edit — documented in `independentPaths`

Do not import `apps/web/src/**` from `apps/reference` or vice versa.

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

**Generation flow:**

```text
packages/ui/components.json → packages/ui/src/components/ui → @atlas/ui public exports
                                                              ├── apps/web
                                                              └── apps/reference
```

Run shadcn generation against `packages/ui` only. Neither application maintains a local primitive
tree (`apps/web/components.json` must not be recreated).

**Public API:** `import { Button } from "@atlas/ui"` and documented subpaths (`globals.css`,
`theme-boot`, `extended`). Do not import from `packages/ui/src/**` — ESLint enforces this.

Heavy optional primitives with substantial runtime dependencies are exported from
`@atlas/ui/extended`; the default barrel contains the commonly used foundation surface.

**Styling rule:** upstream primitive appearance comes from current shadcn generation; Atlas owns
behavioral wrappers and monorepo integration only. Reusable application compositions should be
extracted only after they are proven across independent reference surfaces.

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

The **clean Atlas consumer starter application**. Owns route composition, provider wiring, and
starter examples. Not published as a library — forked and replaced by consumers.

### `apps/reference` (`@atlas/reference`)

The **executable reference application**. Owns the coherent product journey, harness, and reference
feature modules. Optional in consumer forks. Not published as a library.

---

## Import boundaries

Each application resolves `@/*` to its own `src/` tree. Applications do not import source code from
each other — both consume workspace packages through public package APIs.

```text
apps/web @/*              → apps/web/src/* only
apps/reference @/*        → apps/reference/src/* only

apps/web → apps/reference/src/**      forbidden
apps/reference → apps/web/src/**      forbidden

packages/ui internals   → package-local / relative imports only
```

1. **App → package:** Use public exports only (`@atlas/ui`, `@atlas/consent`).
2. **Package → app:** Never. Packages do not import consumer code.
3. **Feature → feature:** Never. Extract shared logic to `lib/`.
4. **Product → reference/example:** Never in the starter app. Reference modules are not imported by
   product features.
5. **App → other app:** Never. `apps/web` and `apps/reference` are independent consumers.
6. **No `@/*` bypass to package source:** Each `@/*` alias resolves to that app's `src/*` only.
7. **No app resolution of package internals:** Applications must not resolve or import
   `packages/ui/src/**` through TypeScript aliases. `@atlas/ui` is consumed through its public
   package exports.

ESLint guards in each application's `eslint.config.mjs` enforce fetch, env, analytics SDK, package
source import, and UI-internal alias rules.

---

## Related work

The canonical shadcn/Base UI foundation is complete. Storybook, accessibility, and visual-regression
hardening is enforced by the **UI Quality** workflow. Executable `atlas upgrade` / migration tooling
and agent workflow guidance are documented in [upgrades.md](upgrades.md), [cli.md](cli.md),
[AGENTS.md](../../AGENTS.md), and [ADR-0010](../adr/0010-atlas-upgrades-downstream-propagation.md).

Reusable application compositions should be extracted to shared packages only when proven across
independent reference surfaces.

---

## Related docs

- [Upgrades and downstream propagation](upgrades.md) — upgrade contract and ownership matrix
- [Folder structure](folder-structure.md) — where code lives
- [Atlas project contract](atlas-contract.md) — machine-readable architecture for tooling
- [API & data fetching](api.md) — client and contract usage
- [Reference examples](examples.md) — `/examples` routes
- [ADR-0007: Architecture ownership model](../adr/0007-architecture-ownership-model.md)
