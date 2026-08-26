---
name: build-atlas-feature
description:
  Builds or modifies production-quality frontend features in the Atlas web app. Use when adding
  pages, feature modules, data-fetching hooks, forms, or UI in apps/web. Delegates architecture to
  Atlas CLI contracts — not duplicated prose rules.
---

# Build Atlas Feature

Canonical workflow: [docs/how-we-build/agents.md](../../../docs/how-we-build/agents.md)

## 1. Discover

```bash
pnpm --filter @atlas/cli build
pnpm atlas context --json
pnpm atlas generate list --json
```

1. Read root [AGENTS.md](../../../AGENTS.md).
2. Use `documentation.references` from context for relevant `docs/how-we-build/` topics.
3. Inspect nearest example under `apps/web/src/app/examples/` or `apps/reference/src/features/`.

## 2. Plan

Report: route, feature module, **generator command** (if structural), components to reuse, API
contract, hooks, UI states, tests, files to change.

Distinguish generator-supported structural work vs product-specific implementation.

## 3. Implement

```bash
pnpm atlas -- generate feature <name> [--query] [--mutation] [--form] [--tests]
pnpm atlas -- generate page <route>
```

Then implement domain behavior in consumer-owned surfaces. Do not hand-modify generated artifacts or
overwrite independent/consumer-owned files based on assumptions.

## 4. Validate

```bash
pnpm atlas doctor --json
pnpm lint && pnpm typecheck && pnpm test
```

Add `pnpm build`, scoped tests, or E2E when the change requires them (see context
`validation.recommended`).

### Doctor response

| Class                         | Action                                            |
| ----------------------------- | ------------------------------------------------- |
| Stale generated artifact      | Run canonical generator; rerun Doctor             |
| Ownership / boundary conflict | Do not overwrite consumer files; surface conflict |
| Independent wiring differs    | Do not normalize automatically                    |
| Ambiguous                     | Stop and ask                                      |

## 5. Review

Contract compliance, ownership, no unintended generated drift, Doctor result, test evidence.

## 6. Report

Implemented, reused patterns, validation commands + results, risks/follow-ups.

## When not to use

Backend-only, CI/tooling-only, docs-only, or platform-wide shared infrastructure changes needing
architectural review.
