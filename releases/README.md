# Atlas release snapshots

Versioned release snapshots let `atlas upgrade` plan upgrades **without Git ancestry** to upstream
Atlas.

Each supported Atlas release may ship a directory under `releases/<version>/` containing:

| Artifact                | Purpose                                                                         |
| ----------------------- | ------------------------------------------------------------------------------- |
| `release.snapshot.json` | Machine-readable metadata (versions, manifest subset, package versions)         |
| `apps/web/**`           | Synced, generated, and independent template files for the canonical application |
| `openapi/openapi.json`  | Optional OpenAPI spec at that release (consumer-owned in typical forks)         |

## `release.snapshot.json` (schema v1)

```json
{
  "schemaVersion": 1,
  "atlasVersion": "0.2.0",
  "contractSchemaVersion": 1,
  "templateManifestSchemaVersion": 1,
  "canonicalApplication": "apps/web",
  "syncedPaths": ["src/lib/api/errors.ts"],
  "generatedPaths": ["src/lib/api/contracts/schema.ts"],
  "independentPaths": ["src/lib/application/authz.ts"],
  "packageVersions": {
    "@atlas/ui": "0.2.0"
  },
  "openApiSpecRelativePath": "openapi/openapi.json"
}
```

The loader (`packages/cli/src/upgrade/release-snapshot.ts`) validates this manifest and reads file
contents from the release directory. Source-era snapshots are required so paths introduced after a
consumer baseline are not invisible to the planner.

## Rehearsal snapshots

`releases/0.1.0/` and `releases/0.2.0/` contain a **minimal rehearsal pair** used by CLI upgrade
tests and documented in [upgrades.md](../docs/how-we-build/upgrades.md). They do not represent the
full production manifest surface.

See [upgrades.md](../docs/how-we-build/upgrades.md) and [cli.md](../docs/how-we-build/cli.md).
