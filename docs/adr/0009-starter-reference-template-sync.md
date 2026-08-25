# ADR-0009: Starter/Reference Template Infrastructure Synchronization

## Status

Accepted

## Context

Atlas ships two independent Next.js applications in the monorepo:

- `apps/web` — the clean consumer starter
- `apps/reference` — an executable reference application that must behave like an independent
  downstream consumer

PR #55 (#39) intentionally separated these applications. Both duplicate Atlas platform template
infrastructure under `src/lib/**`, providers, config glue, and related application plumbing.

Some duplication is desirable: the reference application demonstrates how an external consumer
composes Atlas conventions without importing starter application internals. Unmanaged duplication
drifts and forces duplicate fixes.

Issue #57 requires a deliberate lifecycle model — not zero duplication, and not a monolithic
`@atlas/app-core` package by default.

## Decision

Adopt a **hybrid synchronization model** aligned with existing Atlas tooling:

| Surface                                                                            | Strategy                                                   | Enforcement                                                                                                      |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| OpenAPI `schema.ts`                                                                | Generated independently per app from shared spec           | `pnpm api:gen`, `pnpm api:check`, Doctor `generated-openapi`                                                     |
| Byte-identical template infrastructure                                             | Canonical starter (`apps/web`) + manifest-driven copy sync | `templates/app-infrastructure.manifest.json`, `atlas sync infrastructure`, Doctor `template-infrastructure-sync` |
| Application-owned wiring (breadcrumbs tree, authz composition, analytics provider) | Independently owned per app; divergence allowed            | Manifest `independentPaths` + structural checks                                                                  |
| Reference harness (`src/lib/reference/**`)                                         | Reference-only                                             | Manifest `referenceOnlyPaths`                                                                                    |
| Starter examples UI                                                                | Starter-only                                               | Manifest `starterOnlyPaths`                                                                                      |
| Workspace packages (`@atlas/ui`, `@atlas/consent`, `@atlas/config`)                | Shared runtime primitives                                  | Package boundaries + ESLint                                                                                      |
| ESLint architecture policy                                                         | Structurally conforming, per-app                           | ESLint + Doctor architecture boundaries                                                                          |

### Canonical manifest

`templates/app-infrastructure.manifest.json` records:

- `syncedPaths` — must remain byte-identical between canonical starter and consumer apps
- `independentPaths` — per-app files that share architecture but allow implementation divergence
- `referenceOnlyPaths` / `starterOnlyPaths` — ownership boundaries
- `structuralConformance.requiredInfrastructureModules` — required modules in consumer apps

The canonical starter is `apps/web`. Consumer applications (currently `apps/reference`) receive
synced copies via explicit tooling — not cross-app TypeScript imports.

### Tooling

- `atlas sync infrastructure` — copy drifted synced paths from starter to consumers (`--check`,
  `--dry-run`, `--json`)
- `pnpm template:check` — CI-friendly drift detection
- Atlas Doctor check `template-infrastructure-sync` — actionable diagnostics with stable codes

### What we will not do

- Create `@atlas/app-core` or similar monolithic runtime packages without separate justification
- Import `apps/web` source from `apps/reference` (or vice versa)
- Hide consumer-owned source behind framework magic
- Require byte-identical files where application-owned divergence is intentional

## Alternatives Considered

### Alternative 1: `@atlas/app-core` package

Extract all duplicated infrastructure into one workspace package.

**Pros:**

- Single source of truth
- No copy synchronization

**Cons:**

- Poor fit for forkable template code consumers are expected to customize
- Primarily solves monorepo duplication, not external consumer upgrade paths
- Large package boundary with high coupling

**Why not chosen:** External consumers fork source; they do not import an Atlas application runtime
package. Package extraction remains appropriate only for genuine shared primitives (`@atlas/ui`,
`@atlas/consent`).

### Alternative 2: Byte-identical enforcement only (no sync command)

Doctor fails when any duplicated file diverges; maintainers copy manually.

**Pros:**

- Minimal tooling

**Cons:**

- No deterministic propagation path for #17 upgrade rehearsals
- High friction for bulk infrastructure fixes

**Why not chosen:** Explicit sync tooling documents ownership and enables safe propagation without
cross-app imports.

### Alternative 3: Generator-owned infrastructure files

Regenerate all `lib/**` from templates on every change.

**Pros:**

- Strong consistency

**Cons:**

- Consumers lose ordinary editable source files
- High generator complexity for low-customization files mixed with app-owned wiring

**Why not chosen:** Atlas remains source-owned; sync applies only to manifest-listed paths.

## Consequences

### Positive

- Every duplicated infrastructure surface has documented ownership and update mechanism
- Reference app continues to simulate an independent consumer
- Doctor and CI catch drift without brittle whole-tree equality checks
- Provides concrete evidence for #17 upgrade propagation design

### Negative

- Manifest must be updated when sync policy changes
- Synced paths can still drift until CI or Doctor runs

### Neutral

- OpenAPI generation model unchanged
- ESLint architecture policy remains per-application

## References

- [Architecture ownership](../how-we-build/architecture-ownership.md)
- [Atlas project contract](../how-we-build/atlas-contract.md)
- Issue #57 — synchronization strategy
- Issue #17 — upgrade rehearsal programme (follow-up)
- PR #55 / Issue #39 — starter/reference application separation
