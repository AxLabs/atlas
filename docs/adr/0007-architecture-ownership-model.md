# ADR-0007: Architecture Ownership Model

## Status

**Accepted**

## Context

Before OSS launch, Atlas contained reference code, platform infrastructure, and aspirational
scaffolds without explicit ownership classification. Engineers could not determine from folder names
alone:

- What Atlas owns vs what consumers own
- What is safe to delete vs what to keep
- What is generated vs hand-written
- Whether Google OAuth is the universal auth model

This ADR established a canonical taxonomy to unblock the architecture contract, generators, the
reference application, and the `@atlas/ui` shadcn/Base UI foundation.

## Decision

We adopt a six-class ownership model documented in
[architecture-ownership.md](../how-we-build/architecture-ownership.md):

1. **Core platform** — reusable infrastructure in `lib/` and workspace packages
2. **App-owned** — reference app composition (providers, navigation wiring)
3. **Reference** — pattern demonstrations and the executable reference application (`/examples` in
   starter, `apps/reference/` for the full product journey)
4. **Generated** — machine-owned OpenAPI types
5. **Documentation only** — conventions without code
6. **Removed** — dead abstractions deleted rather than preserved

### Key boundary decisions

| Surface                                         | Decision                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `apps/reference/src/features/users`             | Retained as canonical OpenAPI hook + UI reference in the executable reference application   |
| `components/layout/AppShell`                    | Removed — unused; ExamplesShell owns reference layout                                       |
| `lib/telemetry/sentry.*`                        | Removed — duplicated root Sentry config                                                     |
| `lib/i18n`                                      | Kept minimal — typed key convention, not a localization framework                           |
| `lib/feature-flags`                             | Kept — runtime config + kill switches; PostHog adapter is optional                          |
| Google OAuth                                    | Classified as reference IdP, separate from session security core                            |
| `tsconfig` broad `@/*` UI fallback              | Removed — app code must use `@atlas/ui` public API                                          |
| `tsconfig` narrow `@/lib/*` / `@/hooks/*` shims | Removed — `@atlas/ui` uses relative package-local imports; apps consume public exports only |

## Alternatives Considered

1. **Remove `features/users` entirely** — Rejected. The hook-level OpenAPI pattern is valuable for
   `atlas generate feature` without requiring a fake UI.
2. **Promote AppShell to platform** — Rejected. No consumers; ExamplesShell already demonstrates
   layout composition.
3. **Build full i18n framework** — Rejected. Out of scope; English-only `t()` suffices as
   convention.
4. **New package per concern** — Rejected. Monorepo ≠ every concern deserves a package.

## Consequences

### Positive

- Clear keep/delete/replace guidance for consumers
- Stable foundation for later CLI, Doctor, generators, and upgrade tooling
- ESLint + tsconfig enforce package boundaries; apps do not alias into `packages/ui/src/**`

### Negative

- Reference modules add repo surface area (the executable reference application now consumes them)
- Docs must stay synchronized with classification table

## References

- [architecture-ownership.md](../how-we-build/architecture-ownership.md)
- ADR-0004 (auth), ADR-0003 (data fetching), ADR-0005 (observability), ADR-0006 (consent)
