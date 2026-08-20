# Reference: OpenAPI-backed users feature

**Classification:** reference implementation — safe to delete or replace.

This module is the canonical typed-resource reference for Atlas feature architecture. It
demonstrates how to wire OpenAPI-generated contracts into React Query hooks without UI scaffolding.

## What it demonstrates

- Query key factory via `createQueryKeys` (`keys.ts`)
- Type-safe queries against `api.users.*` from `@/lib/api/contracts` (`queries.ts`)
- Mutations with cache invalidation (`mutations.ts`)
- Public barrel export (`index.ts`)

## What it does not demonstrate

- Page or component consumption (intentionally omitted — see #39 for the coherent reference app)
- Authorization or permissions (#41)
- Domain-specific validation schemas

## When to keep vs remove

| Situation                                             | Action                                             |
| ----------------------------------------------------- | -------------------------------------------------- |
| Forking Atlas and building your own OpenAPI consumers | Remove once you have your own feature modules      |
| Learning Atlas data-fetching patterns                 | Keep and study; copy structure for new features    |
| Running Atlas as-is                                   | Harmless — hooks are tree-shaken if never imported |

## Regenerating types

When the OpenAPI spec changes:

```bash
pnpm --filter @atlas/web api:gen
```

Generated types live in `src/lib/api/contracts/schema.ts` (machine-owned — do not edit).
