# ADR-0008: Atlas Project Architecture Contract

## Status

**Accepted**

## Context

Atlas architectural decisions are documented across human-readable docs, ADRs, ESLint rules, and
repository layout. CLI, generators, Doctor, migrations, and agent workflows cannot reliably consume
all of those sources. Atlas needs a small, declarative, machine-readable contract with a single
typed loader.

## Decision

1. Add **`atlas.config.json`** at the repository root as the author-written contract.
2. Implement **`@atlas/project`** (`packages/project`) as the sole schema, loader, resolver, and
   serializer for Atlas tooling.
3. Use **contract `schemaVersion`** (starting at `1`) independent of Atlas release SemVer.
4. Encode only machine-relevant architecture: application/feature/reference roots, shared UI
   identity, generated OpenAPI output, capability flags, and boundary facts.
5. Keep enforcement in existing systems (ESLint, tests); the contract states facts, not rule
   implementations.

Unsupported contract schema versions fail clearly. Unknown JSON keys are rejected via strict Zod
parsing. Contract migrations belong to `atlas upgrade`.

## Alternatives Considered

1. **`atlas.config.ts`** — Rejected. Tooling should not execute arbitrary project code to discover
   architecture.
2. **Duplicate ESLint rules in the contract** — Rejected. Creates dual ownership and drift.
3. **Place loader in `apps/web`** — Rejected. Repo-level tooling must not depend on the application
   package.
4. **JSON Schema as canonical source** — Rejected for v1. Zod is already used; runtime validation +
   TypeScript inference is sufficient.

## Consequences

### Positive

- One loader for CLI, generators, Doctor, migrations, and agents
- Deterministic resolved JSON without machine-specific absolute paths
- Vendor-neutral architecture context for coding agents (`AGENTS.md` points to contract)

### Negative

- Contract and human docs must stay aligned when architecture changes
- Schema version bumps require coordinated loader updates (`atlas upgrade` for migrations)

## References

- [atlas-contract.md](../how-we-build/atlas-contract.md)
- ADR-0007 — architecture ownership model
