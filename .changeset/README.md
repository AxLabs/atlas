# Changesets

Atlas uses [Changesets](https://github.com/changesets/changesets) to collect per-PR change metadata
and open **Version PRs**. Changesets do **not** publish npm packages. After a Version PR merges,
separate fail-closed automation creates the canonical Git tag and GitHub Release.

See [Releases and Governance](../docs/how-we-build/releases-and-governance.md).

```bash
pnpm changeset        # Add a changeset in your PR
pnpm changeset:status # Preview pending version bumps
```

### Bump convention

The pending launch-surface release uses **patch** (`1.0.0` → `1.0.1`). After `1.0.0`:

- **patch** — bug fixes and small non-breaking work (`1.0.0 → 1.0.1`)
- **minor** — compatible features (`1.0.0 → 1.1.0`)
- **major** — breaking public-contract changes (`1.0.0 → 2.0.0`)
