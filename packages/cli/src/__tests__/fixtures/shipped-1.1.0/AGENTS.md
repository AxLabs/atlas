# Atlas — Agent Guide

Atlas is a forkable frontend platform template monorepo (Next.js App Router, TypeScript, Tailwind
CSS, pnpm workspaces). Product teams ship features using shared patterns for auth, data fetching,
validation, theming, accessibility, and observability.

**Start here for workflow.** Detailed agent guidance lives in
[docs/how-we-build/agents.md](docs/how-we-build/agents.md).

---

## What is Atlas?

A monorepo template with:

- `apps/web` — starter product application
- `apps/reference` — executable reference application
- `packages/ui` — reusable UI primitives
- `packages/cli` — Atlas CLI (`atlas`)
- `packages/project` — project contract loader
- `atlas.config.json` — author contract (resolved via `@atlas/project`)

See [architecture ownership](docs/how-we-build/architecture-ownership.md) for ownership boundaries.

---

## Discover the current project

```bash
pnpm --filter @blitzcraftlabs/atlas build
pnpm atlas context
pnpm atlas context --json
```

`atlas context` resolves the project contract, ownership manifest, generators, Doctor capabilities,
upgrade semantics, validation commands, and documentation references. It composes existing
executable sources — there is no separate agent architecture file.

---

## Structural scaffolding (use generators)

When Atlas supports the structural operation, use generators instead of hand-building conventions:

```bash
pnpm atlas generate list --json          # discover supported generators
pnpm atlas generate feature <name> [--query] [--mutation] [--form] [--tests]
pnpm atlas generate page <route>
```

Product logic inside generated shells is normal source editing.

---

## Validate architecture

```bash
pnpm atlas doctor
pnpm atlas doctor --json
```

Then run standard engineering validation:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

`atlas doctor` checks Atlas-specific contract and architecture drift. It does not replace lint,
typecheck, tests, or build. See [doctor.md](docs/how-we-build/doctor.md) for diagnostic codes and
safe vs unsafe auto-fix behavior.

Additional checks when relevant: `pnpm build`, `pnpm api:check`, `pnpm template:check`,
`pnpm docs:check`, `pnpm governance:check`, `pnpm validate:env`, E2E — see `validation.recommended`
in `atlas context --json`.

---

## Upgrades and migrations

Do not infer upgrade requirements from Git diffs alone:

```bash
pnpm atlas upgrade --to <version> --dry-run --json
```

Treat `merge-required`, `manual-review`, and `security-critical` conflicts as blocking for silent
auto-resolution. See [upgrades.md](docs/how-we-build/upgrades.md).

---

## Documentation and ADRs

Canonical conventions: [docs/how-we-build/README.md](docs/how-we-build/README.md)

Key ADRs: listed in `atlas context --json` → `documentation.adrs`

| Topic             | Location                                                                   |
| ----------------- | -------------------------------------------------------------------------- |
| Agent workflow    | [docs/how-we-build/agents.md](docs/how-we-build/agents.md)                 |
| Atlas CLI         | [docs/how-we-build/cli.md](docs/how-we-build/cli.md)                       |
| Project contract  | [docs/how-we-build/atlas-contract.md](docs/how-we-build/atlas-contract.md) |
| Authorization     | [docs/how-we-build/authorization.md](docs/how-we-build/authorization.md)   |
| API & React Query | [docs/how-we-build/api.md](docs/how-we-build/api.md)                       |
| Testing           | [docs/how-we-build/testing.md](docs/how-we-build/testing.md)               |
| Examples          | `apps/web/src/app/examples/`, `apps/reference/src/features/`               |

---

## When to stop and ask

- Ownership is ambiguous (synced vs independent vs product-owned)
- Doctor reports architectural conflict on consumer-owned paths
- Upgrade dry-run contains `merge-required` or `manual-review` items
- Change touches shared infrastructure (`packages/ui`, core `lib/`) without clear scope
- Generator cannot represent the required structural shape

---

## Vendor adapters (not canonical)

Thin conveniences that delegate to this guide and executable tooling:

- `.cursor/rules/` — Cursor rules
- `.cursor/skills/` — Cursor skills (for example `build-atlas-feature`)
- `apps/*/CLAUDE.md` — Claude Code pointer to `AGENTS.md`

Generic `AGENTS.md`-compatible agents are the portable path. No MCP server or hosted service is
required.

---

## Repository map

```
atlas/
├── apps/web/              # Starter application
├── apps/reference/        # Reference application
├── packages/ui/           # @atlas/ui
├── packages/cli/          # @blitzcraftlabs/atlas
├── packages/project/      # @atlas/project
├── atlas.config.json      # Author contract
├── openapi/               # OpenAPI specification
└── docs/how-we-build/     # Canonical conventions
```

---

## Judgment rules (brief)

- Prefer existing Atlas components and nearby patterns
- No raw `fetch()` in UI layers — use `@/lib/api`
- No direct `process.env` in application code — use `@/config`
- No cross-feature imports — extract to `lib/` if needed
- No business logic in `app/` route files
- Do not promote code to shared packages speculatively
- Preserve accessibility and responsive layout
- Keep changes focused — no unrelated refactors

Full prohibited patterns and domain guidance remain in feature docs and ESLint policy. Run Doctor
rather than duplicating architecture checks in agent prompts.
