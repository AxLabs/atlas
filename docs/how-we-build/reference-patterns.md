# Reference patterns

> Adopt settings, permission-aware CRUD, and diagnostics without importing the Atlas reference app.

`apps/reference` is the Atlas evaluation harness. Generated consumers are created from `apps/web`.
Do not add the entire reference app to a product repository.

Upstream illustration (read-only):
https://github.com/blitzcraftlabs/atlas/tree/main/apps/reference/src/features

## Settings

1. `atlas generate page settings`
2. Compose consent (`@atlas/consent`), theme (`@atlas/ui` theme hooks), and i18n strings in a
   feature module — not in the route file.
3. Keep environment access behind `@/config`.

Illustration: `apps/reference/src/features/components/ReferenceSettingsView.tsx`. Copy composition,
not harness-only controls.

## Permission-aware CRUD

1. `atlas generate feature <name> --query --mutation --form --tests`
2. Register permissions in `src/lib/application/authz.ts`.
3. Gate UI with `Can` / `usePermission` and server routes with `requirePermission`.
4. Handle loading, empty, error, and success with `@atlas/ui` app-state components.

Illustration: `apps/reference/src/features/users/`. Implement against your API contract.

## Platform diagnostics

Read runtime config, feature flags, and telemetry through existing facades. A product status page
may display **non-secret** capability state.

Do **not** copy into a product app:

- Simulated authentication / persona switchers
- Reset endpoints that wipe in-memory stores
- Failure-injection or scenario switches
- `ATLAS_REFERENCE_MODE` and `src/lib/reference/**`

Those remain development-only in this repository and are not packaged or enableable.

See [examples.md](examples.md), [authorization.md](authorization.md), [api.md](api.md), and
[consumer-tooling.md](consumer-tooling.md).
