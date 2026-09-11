# Atlas Releases and Governance

> **Canonical source of truth** for Atlas licensing, versioning, releases, support, breaking
> changes, and migration policy. Other documentation links here rather than restating these rules.

---

## Licensing

Atlas is **open source under Apache License 2.0**. The canonical public repository is
[`blitzcraftlabs/atlas`](https://github.com/blitzcraftlabs/atlas).

| Item                         | Policy                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **License file**             | Root [`LICENSE`](../../LICENSE)                                                                            |
| **Scope**                    | In-repository source, documentation, configuration, and other materials unless explicitly marked otherwise |
| **Workspace packages**       | `@atlas/ui`, `@atlas/config`, `@atlas/consent`, `@atlas/web` are **internal workspace packages**           |
| **Third-party dependencies** | Retain their own licenses                                                                                  |
| **Third-party provenance**   | [provenance.md](provenance.md), [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md)                   |

The repository is public. Workspace packages remain unpublished npm internals (`private: true`).
Canonical GitHub Releases are published automatically after a Version PR merges to `main`.

---

## What is versioned?

**Atlas itself** — a **repository/platform snapshot**, not independent npm products.

| Package                  | Role                         | Published to npm? | Independently supported? |
| ------------------------ | ---------------------------- | ----------------- | ------------------------ |
| `@atlas/monorepo` (root) | Canonical Atlas version      | No                | This is Atlas            |
| `@atlas/web`             | Template application         | No                | Part of Atlas snapshot   |
| `@atlas/reference`       | Executable reference app     | No                | Part of Atlas snapshot   |
| `@atlas/ui`              | Internal UI primitives       | No                | Part of Atlas snapshot   |
| `@atlas/config`          | Internal tooling config      | No                | Part of Atlas snapshot   |
| `@atlas/consent`         | Optional consent module      | No                | Part of Atlas snapshot   |
| `@atlas/project`         | Architecture contract loader | No                | Part of Atlas snapshot   |
| `@atlas/cli`             | Atlas-specific CLI           | No                | Part of Atlas snapshot   |

Workspace `package.json` version fields mirror the Atlas release for tooling only.

---

## Versioning policy

Atlas uses **[Semantic Versioning](https://semver.org/)** for repository releases.

| Version             | Meaning                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------- |
| **Major (`X.0.0`)** | Reserved for a deliberately defined stable public contract. **Atlas has not reached 1.0.0.** |
| **Minor (`0.x.0`)** | Intentional release: new capability, platform change, or **breaking change while pre-1.0**   |
| **Patch (`0.x.y`)** | Bug fixes and low-risk adjustments within the current line                                   |

### Pre-1.0 (`0.x.y`)

- Atlas is **released intentionally** but APIs, templates, and upgrade mechanics may evolve.
- Breaking changes are allowed but must be documented (see below).
- **`1.0.0` is only created through an explicit maintainer stability decision** — not by routine
  changesets.
- A future `1.0.0` release requires a dedicated maintainer decision PR that updates or removes the
  pre-1.0 guard in `scripts/semver-utils.mjs` as part of defining the stable public contract. There
  is no environment-variable bypass — the intentional friction is useful.

### Pre-1.0 changeset convention

Changesets `major` bumps advance `0.x.y` to **`1.0.0`**. To avoid accidental graduation:

| Change type                       | Changeset bump              | Example         |
| --------------------------------- | --------------------------- | --------------- |
| Bug fix / small non-breaking      | **patch**                   | `0.1.0 → 0.1.1` |
| Feature or **breaking change**    | **minor**                   | `0.1.0 → 0.2.0` |
| Deliberate 1.0 stability decision | **major** (maintainer-only) | `0.9.0 → 1.0.0` |

Do **not** select **major** for ordinary breaking changes while Atlas remains pre-1.0.

### Historical / internal tags

| Tag                | Meaning                                             |
| ------------------ | --------------------------------------------------- |
| `v0.1.0-pre-split` | Internal pre-split snapshot                         |
| `v1.0.0-platform`  | Internal milestone — **not** a public `1.0` promise |

Canonical release tags: `v{MAJOR}.{MINOR}.{PATCH}` (e.g. `v0.2.0`). `0.1.0` remains a historical
internal snapshot and must not receive a public tag.

---

## What constitutes an Atlas release?

A deliberate tagged snapshot at one SemVer version. Intended contents:

| Artifact            | Status                  | Notes                                                                          |
| ------------------- | ----------------------- | ------------------------------------------------------------------------------ |
| Git tag `vX.Y.Z`    | After Version PR merge  | Never retagged; never `v0.1.0`                                                 |
| GitHub Release      | After Version PR merge  | Fail-closed notes + SBOM; no npm publish                                       |
| Root `CHANGELOG.md` | Yes                     | Canonical history                                                              |
| Migration notes     | When needed             | `docs/migrations/`                                                             |
| SPDX SBOM snapshot  | Yes                     | Workflow artifact and GitHub Release asset; 90-day workflow retention          |
| CI evidence         | Required before publish | Publication waits for CI, Security Audit, and UI Quality on the release commit |

---

## Tag format

| Item                | Format            | Example       |
| ------------------- | ----------------- | ------------- |
| Canonical tag       | `vX.Y.Z`          | `v0.2.0`      |
| GitHub Release name | `Atlas {version}` | `Atlas 0.2.0` |
| Not used            | `@atlas/ui@x.y.z` | Misleading    |

### GitHub Release prerelease semantics

- `0.2.0` is a **normal** SemVer release — **not** a GitHub prerelease.
- Only versions with a SemVer **prerelease component** are GitHub prereleases, e.g. `0.2.0-rc.1`.

GitHub Release publication uses the SemVer prerelease component, not the `0.x` major line alone.

---

## Release process

### Day-to-day

1. Add a changeset in your PR: `pnpm changeset`
2. Use the pre-1.0 bump convention above.
3. Include migration steps in the changeset body for breaking changes.

### Version PR (automated on `main`)

When changesets merge to `main`, the Release workflow opens/updates a Version PR:

- Title: `chore(release): atlas version`
- Bumps all workspace packages to the same version (fixed group)
- Consolidates release notes into root [`CHANGELOG.md`](../../CHANGELOG.md)
- Consumes changeset files

The Version PR must pass normal CI and Governance. It does not create a Git tag.

Changesets Version PRs are created by GitHub Actions. Depending on repository or GitHub organization
policy, GitHub may require a maintainer to approve workflow execution on an automation-created pull
request. If checks do not start on the Version PR, review the generated PR and use **Approve
workflows to run** when GitHub presents that option. This is not guaranteed on every repository — it
depends on your settings.

Publication still waits for required checks on the release commit before creating the canonical tag
or GitHub Release.

### GitHub Release publication

After the Version PR merges to `main`, the Release workflow publishes fail-closed:

1. Confirm root/workspace versions match and `CHANGELOG.md` contains that version
2. Refuse historical `0.1.0` (never create `v0.1.0`; pending changesets are a safe no-op)
3. Refuse publication when release-bearing `.changeset/*.md` files remain after a Version PR
4. Refuse retagging or recreating a release for a different SHA
5. Wait for required **CI**, **Security Audit**, and **UI Quality** checks on the release commit
6. Create `vX.Y.Z` at that SHA
7. Create the GitHub Release with changelog-derived notes, SBOM, and license notice
8. No-op when the current version is already published with required assets, or is not a new
   releasable version
9. Repair a missing Release or missing required SBOM at the same SHA without retagging

Workspace packages are not published to npm. Publication does not claim signed provenance, SLSA, or
a formal security audit.

### Rehearsal

```bash
pnpm governance:check   # policy invariants
pnpm release:rehearse   # isolated worktree; version transform + publication dry-run
```

GitHub Actions: run the **Release** workflow via `workflow_dispatch`. That path generates SBOM and
release notes and must not create a Git tag or GitHub Release.

### Commands

```bash
pnpm changeset
pnpm changeset:status
pnpm changeset:version   # local only; CI uses this in Version PR
pnpm governance:check
pnpm release:rehearse
pnpm docs:check          # documentation links
```

---

## Changelog

Root [`CHANGELOG.md`](../../CHANGELOG.md) is the **canonical Atlas release history**.

Workspace `CHANGELOG.md` files under `apps/web` and `packages/*` are **Changesets-generated
implementation artifacts**. They must remain on disk after `pnpm changeset:version` because
`changesets/action@v1` reads each changed package changelog **after** the custom version command
returns. They are not independently supported package release histories.

After `changeset version`, `scripts/consolidate-atlas-release.mjs`:

1. Reads workspace package changelogs written by Changesets
2. Moves everything currently under root `[Unreleased]` into the new release section (then resets
   `[Unreleased]` to empty)
3. Merges workspace release bodies into that section, deduplicating identical content
4. Updates root `CHANGELOG.md` **without discarding prior release sections or link references**
5. Advances the `[Unreleased]` compare link and adds/updates the new version link reference
6. Syncs versions across root and workspaces
7. **Does not delete** workspace package changelogs (required by `changesets/action`)

---

## Support policy

| Topic                          | Policy                                                                     |
| ------------------------------ | -------------------------------------------------------------------------- |
| Supported line                 | Current Atlas release on `main` after the latest intentional version merge |
| Security / compatibility fixes | Prioritized for the latest supported release                               |
| Older pre-1.0 snapshots        | Fixes only when explicitly stated                                          |
| LTS                            | **No LTS programme** at this stage                                         |

---

## Breaking changes and migrations

Breaking changes must document:

- what changed; affected surfaces; who is affected; migration steps; compatibility constraints;
  deprecation/removal timeline where applicable.

### Where to document

1. Changeset body (**minor** bump pre-1.0)
2. Root changelog under `### Breaking Changes`
3. `docs/migrations/` when steps are non-trivial

### Deprecation

| Stage                    | Expectation                                                |
| ------------------------ | ---------------------------------------------------------- |
| Announced                | Changelog + `@deprecated` JSDoc when applicable            |
| Minimum notice (pre-1.0) | At least one minor release before removal when practicable |
| Owner                    | PR author or named maintainer in migration doc             |

See [`docs/migrations/README.md`](../migrations/README.md).

---

## Changesets rationale

Retained to collect per-PR metadata and drive Version PRs — **not** to publish independent npm
products. All workspace packages share one version via a **fixed** changeset group.

---

## Related documentation

| Topic                      | Canonical source                                                    |
| -------------------------- | ------------------------------------------------------------------- |
| Security release artifacts | [security.md](security.md), `.github/workflows/security-audit.yml`  |
| Upgrade rehearsal          | [upgrades.md](upgrades.md)                                          |
| Third-party provenance     | [provenance.md](provenance.md)                                      |
| GitHub Release status      | Published after Version PR merge; rehearsal via `workflow_dispatch` |

---

## Quick reference

| Question                        | Answer                                                                  |
| ------------------------------- | ----------------------------------------------------------------------- |
| License?                        | Apache-2.0 ([`LICENSE`](../../LICENSE))                                 |
| Public repo today?              | Yes — [`blitzcraftlabs/atlas`](https://github.com/blitzcraftlabs/atlas) |
| Versioned product?              | Atlas repository snapshot                                               |
| Tag format?                     | `vX.Y.Z`                                                                |
| Breaking change bump (pre-1.0)? | **minor** changeset                                                     |
| npm publish?                    | No                                                                      |
| GitHub Release today?           | After Version PR merge (`vX.Y.Z`); never `v0.1.0`                       |
