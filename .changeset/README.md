# Changesets

Atlas uses [Changesets](https://github.com/changesets/changesets) to collect per-PR change metadata
and open **Version PRs**. Changesets do **not** publish npm packages. After a Version PR merges,
separate fail-closed automation creates the canonical Git tag and GitHub Release.

See [Releases and Governance](../docs/how-we-build/releases-and-governance.md).

```bash
pnpm changeset        # Add a changeset in your PR
pnpm changeset:status # Preview pending version bumps
```

### Pre-1.0 bump convention

While Atlas remains below `1.0.0`:

- **patch** — bug fixes and small non-breaking work (`0.1.0 → 0.1.1`)
- **minor** — features and **breaking changes** (`0.1.0 → 0.2.0`)
- do **not** use **major** in changesets — that would advance to `1.0.0`
