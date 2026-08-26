# Migration: atlas-rehearsal-step-a

| Field                | Value                    |
| -------------------- | ------------------------ |
| Migration ID         | `atlas-rehearsal-step-a` |
| Source Atlas version | `0.1.0`                  |
| Target Atlas version | `0.2.0`                  |
| Mode                 | Automatic                |

## What changes

- Adds `platform.migrationRehearsal.stepA: true`
- Adds `platform.migrationRehearsal.legacyFlag: true` in `atlas.config.json`

## What never changes

- Product features, routes, and consumer-owned independent paths
- Synced template files (handled by the upgrade planner after migrations complete)
- Workspace `@atlas/*` package versions (plan-only in v0.1)

## Manual follow-up

None for supported rehearsal consumers on the `0.1.0 → 0.2.0` chain.
