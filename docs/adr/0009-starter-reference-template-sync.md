# ADR-0009: Starter/Reference Template Infrastructure Synchronization

## Status

Accepted

## Context

Atlas ships two independent Next.js applications in the monorepo:

- `apps/web` — the clean consumer starter
- `apps/reference` — an executable reference application that must behave like an independent
  downstream consumer

The starter and reference applications were intentionally separated. Both duplicate Atlas platform
template infrastructure under `src/lib/**`, providers, config glue, and related application
plumbing.

Some duplication is desirable: the reference application demonstrates how an external consumer
composes Atlas conventions without importing starter application internals. Unmanaged duplication
drifts and forces duplicate fixes.

The synchronization strategy and tooling shape are defined here. This ADR does **not** define the
complete downstream upgrade model for external Atlas consumers — that is documented in
[upgrades.md](../how-we-build/upgrades.md) and
[ADR-0010](0010-atlas-upgrades-downstream-propagation.md).

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
- `generatedPaths` — machine-generated artifacts documented for ownership clarity; **not** copied by
  template sync (freshness enforced by OpenAPI generation/checking)
- `independentPaths` — per-app files that share architecture but **allow** implementation divergence
  (equality with the starter is permitted; divergence is not required)
- `referenceOnlyPaths` / `starterOnlyPaths` — ownership boundaries
- `structuralConformance.requiredInfrastructureModules` — required modules in consumer apps

Manifest entries are validated before comparison or filesystem writes. Overlapping classifications,
absolute paths, traversal segments, and unknown consumer keys are rejected with actionable errors.

The canonical starter is `apps/web`. Consumer applications (currently `apps/reference`) receive
synced copies via explicit tooling — not cross-app TypeScript imports.

### Tooling

- `atlas sync infrastructure` — copy drifted synced paths from starter to consumers
- `pnpm template:check` — CI-friendly drift detection (`atlas sync infrastructure --check`)
- `pnpm template:sync` — apply repairs (`atlas sync infrastructure`)
- Atlas Doctor check `template-infrastructure-sync` — actionable diagnostics with stable codes

#### Command semantics

| Mode        | Mutates files | Exit behavior                                                                                        |
| ----------- | ------------- | ---------------------------------------------------------------------------------------------------- |
| default     | yes           | Re-validates after writes; exit `0` when repairable drift is cleared and no structural issues remain |
| `--check`   | no            | Reports current drift/structure; exit non-zero when drift or structural issues exist                 |
| `--dry-run` | no            | Reports planned copies without writing; exit non-zero when drift exists (same as `--check`)          |

Mutating sync compares, plans, applies copy actions for repairable synced-path drift, then **re-runs
comparison** and reports the resulting state. Human and JSON output distinguish initial drift,
planned actions, applied actions, remaining drift, remaining structural issues, and final health.

Generated OpenAPI schemas are not template-synced. Doctor delegates generated-schema freshness to
the existing `generated-openapi` check rather than duplicating that logic in template sync.

### What we will not do

- Create `@atlas/app-core` or similar monolithic runtime packages without separate justification
- Import `apps/web` source from `apps/reference` (or vice versa)
- Hide consumer-owned source behind framework magic
- Require byte-identical files where application-owned divergence is intentional
- Copy generated artifacts through template sync

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

- No deterministic propagation path for upgrade rehearsals
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
- Provides concrete evidence for upgrade propagation design

### Negative

- Manifest must be updated when sync policy changes
- Synced paths can still drift until CI or Doctor runs

### Neutral

- OpenAPI generation model unchanged
- ESLint architecture policy remains per-application

## Implications for upgrades

This ADR establishes **ownership classification and monorepo repair tooling** — not a full external
consumer upgrade path. Evidence for the upgrade contract includes:

- **Synced template paths** are the primary bulk-propagation surface; repair is deterministic copy
  from the canonical starter when consumers have not customized those files.
- **Independent paths** document where downstream customization is expected; upgrade rehearsals must
  not blindly overwrite these surfaces.
- **Generated artifacts** require regeneration (`pnpm api:gen`) rather than template copy.
- **Structural manifest checks** (reference-only, starter-only, required modules) catch ownership
  mistakes that copy sync cannot fix automatically.
- External consumers will need explicit upgrade guidance per classification — likely combining
  selective copy, regeneration, and manual merge for independent wiring.

## References

- [Architecture ownership](../how-we-build/architecture-ownership.md)
- [Atlas project contract](../how-we-build/atlas-contract.md)
- [Upgrades](../how-we-build/upgrades.md)
