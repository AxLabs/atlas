---
name: build-atlas-feature
description:
  Builds or modifies production-quality frontend features in the Atlas web app using established
  patterns for routes, React Query, forms, and UI states. Use when adding pages, feature modules,
  data-fetching hooks, forms, or demo-style UI in apps/web.
---

# Build Atlas Feature

## 1. Discover

1. Read [AGENTS.md](../../../AGENTS.md).
2. Read relevant docs in `docs/how-we-build/` (especially `folder-structure.md`, `api.md`,
   `testing.md`, `accessibility.md`, `cli.md`).
3. Inspect the closest example page under `apps/web/src/app/examples/` and matching feature under
   `apps/web/src/features/examples/`, or the reference application under
   `apps/reference/src/features/`.
4. Read [architecture ownership](../../docs/how-we-build/architecture-ownership.md) to confirm
   whether you are building product code or touching reference/platform surfaces.

## 2. Plan

Before editing, report:

| Item                | Example                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| Proposed route      | `apps/web/src/app/(app)/reports/page.tsx`                               |
| Feature module      | `apps/web/src/features/reports/`                                        |
| Generator command   | `atlas generate feature reports --query --mutation` when applicable     |
| Components to reuse | `Card`, `EmptyState`, `ErrorFallback` from `@atlas/ui`                  |
| API contract        | `components["schemas"]["Report"]` from `@/lib/api/contracts`            |
| Hooks               | `useReportList` query, `useCreateReport` mutation, `reportKeys` factory |
| UI states           | loading skeleton, empty list, error with retry, success table           |
| Validation & tests  | Zod schema + `renderWithProviders` + MSW fixture                        |
| Files to change     | List each path                                                          |

## 3. Implement

For **new** product structure, start with Atlas generators when the shape matches:

```bash
pnpm atlas -- generate feature <name> [--query] [--mutation] [--form] [--tests]
pnpm atlas -- generate page <route>
```

Then inspect generated files and implement domain behavior. The default generator creates a
route-facing feature component and public boundary (`components/<Name>Feature.tsx`, `index.ts`). Do
not manually recreate generator-owned structural boilerplate unless the generator cannot represent
the required shape.

- Keep routes thin; put domain logic in the configured product feature root from `@atlas/project`.
- Add or extend `keys.ts`, `queries.ts`, `mutations.ts` (or `hooks.ts`), `components/`, `index.ts`.
- Wire the typed API client (`api` from `@/lib/api/contracts` or `apiGet`/`apiPost` from
  `@/lib/api`); normalize errors with `normalizeApiError`.
- Use `createQueryKeys` from `@/lib/react-query` for cache keys; invalidate on mutation success.
- For forms: `useZodForm` + `FormField` + `applyServerFieldErrors`; disable submit while pending.
- Render all interface states with `@atlas/ui` app-state components.
- Use `useConfig()` / `getServerConfig()` for configuration — not `process.env`.
- Avoid unrelated changes and new dependencies.

## 4. Validate

Derive commands from root `package.json` and `apps/web/package.json`. Run the subset that matches
your change:

```bash
# Atlas architecture drift (after contract/routing/feature-structure changes)
pnpm --filter @atlas/cli build
pnpm atlas doctor

# Formatting & lint
pnpm format              # or pnpm format:write to fix
pnpm lint

# Types & unit tests
pnpm typecheck
pnpm test
pnpm --filter @atlas/web test -- path/to/your.test.tsx

# Build & E2E (when user-facing or routing changed)
pnpm build
pnpm --filter @atlas/web test:e2e

# OpenAPI types (only if spec changed)
pnpm api:gen
```

Minimum bar for feature work: `pnpm lint && pnpm typecheck && pnpm test`.

## 5. Review

Scan the diff for:

- [ ] Raw `fetch()` bypassing `@/lib/api`
- [ ] Direct `process.env` or `@/env` in application code
- [ ] Duplicated UI primitives that exist in `@atlas/ui`
- [ ] Domain code placed in `packages/ui` or `lib/` prematurely
- [ ] Missing loading, empty, error, or success states
- [ ] Accessibility regressions (unlabeled inputs, clickable divs, missing focus styles)
- [ ] Unnecessary dependencies or unrelated refactors

## 6. Report

Provide:

1. **Implemented** — route, feature module, and behaviour added or changed
2. **Reused** — Atlas components, hooks, and patterns leveraged
3. **Validation** — exact commands run and results
4. **Risks** — manual checks, E2E gaps, or follow-ups

## When not to use this skill

- Backend-only or API-route-only changes with no UI
- CI, workflow, or tooling-only changes
- Documentation-only edits
- Platform-wide changes to `packages/ui`, `packages/config`, or shared `lib/` infrastructure that
  need architectural review
