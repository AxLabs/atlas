# Migration: atlas-contract-v1-to-v2

| Field                | Value                     |
| -------------------- | ------------------------- |
| Migration ID         | `atlas-contract-v1-to-v2` |
| Source Atlas version | `0.2.0`                   |
| Target Atlas version | `0.3.0`                   |
| Mode                 | Automatic                 |

## What changes

- Transforms `platform.migrationRehearsal.legacyFlag` into `platform.migrationRehearsal.newFlag`
- Records `platform.migrationRehearsal.stepB: true`
- Advances `platform.baseline.contractSchemaVersion` to `2` during successful upgrade finalization

## What never changes

- Consumer-owned product code outside Atlas-managed surfaces
- Independent application wiring unless explicitly reclassified in the release snapshot
- Workspace `@atlas/*` package versions (plan-only in v0.1)

## Manual follow-up

None when the registered migration chain is complete and Doctor passes after upgrade finalization.

If this migration is blocked, inspect `atlas upgrade --dry-run --json` for ownership conflicts or
missing chain edges before retrying.
