# How We Build Atlas

> **The single source of truth for platform conventions.**

This directory contains the canonical documentation for how we build, maintain, and extend Atlas. If
it's not documented here, it's not a rule.

## Philosophy

Atlas is an enterprise-grade frontend platform built for **stability**, **maintainability**, and
**team productivity**. We optimize for:

1. **Explicit over implicit** — Patterns are documented, not tribal knowledge
2. **Fail fast** — Catch errors at build time, not runtime
3. **Type safety** — TypeScript end-to-end with no escape hatches
4. **Convention over configuration** — Standard patterns reduce cognitive load

## Non-Negotiables

These rules apply to all code in Atlas:

| Rule                                      | Why                                             |
| ----------------------------------------- | ----------------------------------------------- |
| pnpm only                                 | Package manager consistency, workspace features |
| TypeScript strict mode                    | Catch errors before runtime                     |
| No `any` without documented justification | Type safety is not optional                     |
| No direct `fetch()` in UI code            | Use centralized API client for consistency      |
| All env vars through `@/env`              | Validated, type-safe, no `process.env`          |
| Tests for shared code                     | Packages and utilities need test coverage       |

## Documentation Index

| Document                                            | What It Covers                                   |
| --------------------------------------------------- | ------------------------------------------------ |
| [Architecture ownership](architecture-ownership.md) | Platform vs reference vs consumer vs generated   |
| [Dependency ownership](dependencies.md)             | Manifest rules, UI/form/MSW ownership            |
| [Agent workflow](agents.md)                         | Coding agent discover → validate workflow        |
| [Upgrades](upgrades.md)                             | Downstream upgrade contract and ownership matrix |
| [Atlas project contract](atlas-contract.md)         | Machine-readable architecture for tooling        |
| [Atlas CLI](cli.md)                                 | Atlas-specific CLI workflows and boundaries      |
| [Folder Structure](folder-structure.md)             | Where code lives and why                         |
| [Environment Variables](env.md)                     | How to add and use env vars                      |
| [API & Data Fetching](api.md)                       | React Query, API client, contracts               |
| [Authorization](authorization.md)                   | Typed permissions, server enforcement, UI gating |
| [Testing](testing.md)                               | Test setup, patterns, utilities                  |
| [Continuous Integration](ci.md)                     | CI layout, self-hosted overlay                   |
| [Security](security.md)                             | Blocking audit, pins, SBOM, runner trust         |
| [Accessibility](accessibility.md)                   | a11y rules and patterns                          |
| [Local Dev Composition](local-dev-composition.md)   | Docker Compose patterns (opt-in)                 |
| [Documentation Policy](documentation-policy.md)     | How we maintain docs                             |
| [Releases & Governance](releases-and-governance.md) | Licensing, versioning, releases, support         |
| [Provenance & redistribution](provenance.md)        | Third-party source, assets, dependency licenses  |
| [Claims register](../audit/claims-register.md)      | Material claims and evidence                     |

## Quick Reference

### Run the app locally

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm validate:env
pnpm dev
```

The reference examples at `/examples` work without `DATABASE_URL`. Add OAuth variables when you wire
up authentication in your product.

### Add a new env var

1. Add schema to `src/schemas/env/[public|server]-runtime-config.ts`
2. Add binding to `src/env/[public|server]-env.ts`
3. Add to `scripts/validate-env.ts`
4. Document in `.env.example`
5. Test: `pnpm validate:env`

### Add a new API endpoint consumer

1. Add types to OpenAPI spec (`openapi/openapi.json`)
2. Regenerate: `pnpm api:gen` (both `apps/web` and `apps/reference` schemas)
3. Create query/mutation hooks in `src/features/[feature]/`
4. Use hooks in components — never call `fetch()` directly

### Add a new UI component

1. Create in `packages/ui/src/components/`
2. Write tests alongside (`*.test.tsx`)
3. Export from `packages/ui/src/index.ts`
4. Add Storybook story for documentation

## Related Resources

- **Architecture Decisions**: [../adr/](../adr/) — Why we made specific choices
- **Claims register**: [../audit/claims-register.md](../audit/claims-register.md) — Evidence-backed
  claims
- **Archived Docs**: [../\_archive/](../_archive/) — Historical only (non-canonical)

## If You Only Read One Thing

**Use the patterns that exist.** Don't reinvent. If a pattern is missing, document it here first,
then implement it. This documentation is the spec.
