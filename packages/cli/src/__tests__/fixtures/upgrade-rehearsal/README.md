# Upgrade rehearsal fixture

This directory provides static evidence for issue #17. The Jest suite in
`packages/cli/src/__tests__/upgrade-rehearsal.test.ts` simulates a consumer forked from Atlas
`0.1.0` and upgrading toward Atlas `0.2.0`.

## Consumer baseline (`0.1.0`)

| Surface                           | State                                                   |
| --------------------------------- | ------------------------------------------------------- |
| `src/lib/api/client.ts`           | Unchanged Atlas-managed infrastructure                  |
| `src/lib/api/errors.ts`           | Unchanged Atlas-managed infrastructure                  |
| `src/lib/auth/session.ts`         | **Consumer customized** authentication/session behavior |
| `src/lib/application/authz.ts`    | Application-owned wiring (independent path)             |
| `src/lib/api/contracts/schema.ts` | Generated artifact from older OpenAPI spec              |
| `src/features/billing/index.ts`   | Consumer-owned product feature                          |

## Simulated Atlas `0.2.0` changes

| Surface                           | Atlas change                          | Expected upgrade behavior          |
| --------------------------------- | ------------------------------------- | ---------------------------------- |
| `src/lib/api/errors.ts`           | Bug fix in synced infrastructure      | Patch-safe replace                 |
| `src/lib/auth/session.ts`         | Security fix in synced infrastructure | Merge-required (consumer modified) |
| `src/lib/application/authz.ts`    | Starter wiring pattern update         | Manual review (independent path)   |
| `src/lib/api/contracts/schema.ts` | OpenAPI spec evolution                | Regenerate (`pnpm api:gen`)        |
| `src/features/billing/index.ts`   | n/a                                   | Never touched                      |

## Conflict policy demonstrated

Atlas must never silently overwrite consumer modifications to synced template infrastructure. The
planner uses **baseline checksums** recorded in `atlas.config.json` `platform.baseline` to
distinguish:

- unchanged consumer copy → safe replacement allowed
- consumer-modified copy → explicit merge-required conflict

See [upgrades.md](../../../../docs/how-we-build/upgrades.md) and
[ADR-0010](../../../../docs/adr/0010-atlas-upgrades-downstream-propagation.md).
