# Fixture upgrade migrations

These migrations exist **only** to exercise the production migration engine in CLI tests. They are
registered in `FIXTURE_MIGRATION_REGISTRY` and activated when a checkout contains
`.atlas-upgrade-fixture`.

They must never ship as production Atlas migrations.

## Chain

| Migration ID          | Versions        | Mutation                                                                      |
| --------------------- | --------------- | ----------------------------------------------------------------------------- |
| `fixture-migration-a` | `0.1.0 → 0.2.0` | Adds `stepA` and `legacyKey` to `fixture.contract.json`                       |
| `fixture-migration-b` | `0.2.0 → 0.3.0` | Renames `legacyKey` → `newKey`, records `stepB`, bumps `schemaVersion` to `2` |

## Usage

- Integration tests call `runUpgrade({ migrationRegistry: FIXTURE_MIGRATION_REGISTRY, ... })`.
- E2E fixture checkouts include `.atlas-upgrade-fixture` so `atlas upgrade` resolves the fixture
  registry automatically.
- Production consumers use `PRODUCTION_MIGRATION_REGISTRY`, which contains only genuine Atlas
  migrations.
