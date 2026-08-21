# Atlas Releases and Governance

> **Canonical source of truth** for Atlas licensing, versioning, releases, support, breaking
> changes, and migration policy. Other documentation links here rather than restating these rules.

---

## Licensing

Atlas is **licensed under Apache License 2.0** and is **preparing for public open-source
distribution** ([#24](https://github.com/blitzcraftlabs/atlas/issues/24)).

| Item                             | Policy                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **License file**                 | Root [`LICENSE`](../../LICENSE)                                                                            |
| **Scope**                        | In-repository source, documentation, configuration, and other materials unless explicitly marked otherwise |
| **Workspace packages**           | `@atlas/ui`, `@atlas/config`, `@atlas/consent`, `@atlas/web` are **internal workspace packages**           |
| **Third-party dependencies**     | Retain their own licenses                                                                                  |
| **Third-party provenance audit** | Issue [#27](https://github.com/blitzcraftlabs/atlas/issues/27)                                             |

**License decision ≠ repository currently public.** The repository may remain private until the OSS
cutover in #24.

---

## What is versioned?

**Atlas itself** — a **repository/platform snapshot**, not independent npm products.

| Package                  | Role                         | Published to npm? | Independently supported? |
| ------------------------ | ---------------------------- | ----------------- | ------------------------ |
| `@atlas/monorepo` (root) | Canonical Atlas version      | No                | This is Atlas            |
| `@atlas/web`             | Template application         | No                | Part of Atlas snapshot   |
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

Canonical release tags: `v{MAJOR}.{MINOR}.{PATCH}` (e.g. `v0.1.0`).

---

## What constitutes an Atlas release?

A deliberate tagged snapshot at one SemVer version. Intended contents:

| Artifact            | In #19             | Notes                               |
| ------------------- | ------------------ | ----------------------------------- |
| Git tag `vX.Y.Z`    | Prepared           | Publication in #24                  |
| GitHub Release      | **Deferred (#24)** | Not created by current automation   |
| Root `CHANGELOG.md` | Yes                | Canonical history                   |
| Migration notes     | When needed        | `docs/migrations/`                  |
| CI evidence links   | When available     | In release notes when #24 publishes |

Do not claim SBOM or security bundles until
[#14](https://github.com/blitzcraftlabs/atlas/issues/14).

---

## Tag format

| Item                         | Format            | Example       |
| ---------------------------- | ----------------- | ------------- |
| Canonical tag                | `vX.Y.Z`          | `v0.2.0`      |
| GitHub Release name (future) | `Atlas {version}` | `Atlas 0.2.0` |
| Not used                     | `@atlas/ui@x.y.z` | Misleading    |

### GitHub Release prerelease semantics

- `0.2.0` is a **normal** SemVer release — **not** a GitHub prerelease.
- Only versions with a SemVer **prerelease component** are GitHub prereleases, e.g. `0.2.0-rc.1`.

Future publication logic ([#24](https://github.com/blitzcraftlabs/atlas/issues/24)) must use the
SemVer prerelease component, not the `0.x` major line alone.

---

## Release process (#19 — publication deferred)

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

**No Git tag or GitHub Release is created** by automation in #19.

### Publication (#24)

Issue #24 will activate:

- tag `vX.Y.Z` at the release commit
- GitHub Release with changelog content
- idempotent create-or-repair publication helpers

### Rehearsal

```bash
pnpm governance:check   # policy invariants
pnpm release:rehearse   # isolated worktree; runs changeset:version mechanics
```

GitHub Actions: run the **Release** workflow via `workflow_dispatch` (dry run only).

### Commands

```bash
pnpm changeset
pnpm changeset:status
pnpm changeset:version   # local only; CI uses this in Version PR
pnpm governance:check
pnpm release:rehearse
pnpm docs:check          # documentation links (#13)
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

## Related issues

| Issue   | Topic                                       | #19 status  |
| ------- | ------------------------------------------- | ----------- |
| **#24** | Public cutover + GitHub Release publication | Deferred    |
| **#14** | Security release artifacts                  | Not claimed |
| **#17** | Upgrade rehearsal programme                 | Separate    |
| **#27** | Third-party provenance                      | Separate    |

---

## Quick reference

| Question                        | Answer                                  |
| ------------------------------- | --------------------------------------- |
| License?                        | Apache-2.0 ([`LICENSE`](../../LICENSE)) |
| Public repo today?              | No — #24                                |
| Versioned product?              | Atlas repository snapshot               |
| Tag format?                     | `vX.Y.Z`                                |
| Breaking change bump (pre-1.0)? | **minor** changeset                     |
| npm publish?                    | No                                      |
| GitHub Release today?           | No — #24                                |
