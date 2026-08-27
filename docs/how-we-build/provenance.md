# Provenance and redistribution audit

Engineering evidence for Atlas issue **#27** — third-party code and asset provenance before public
OSS cutover. This is **not legal advice** or a compliance certification.

**Related:** [#19](https://github.com/blitzcraftlabs/atlas/issues/19) (Apache-2.0 license decision),
[#24](https://github.com/blitzcraftlabs/atlas/issues/24) (public history cutover / purge execution),
[`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md),
[`license-exceptions.json`](../../license-exceptions.json).

---

## 1. Audit scope

### Current tree (HEAD)

| Surface                                                                                 | Reviewed                                |
| --------------------------------------------------------------------------------------- | --------------------------------------- |
| `LICENSE`, `package.json` manifests, workspace packages                                 | Yes                                     |
| `packages/ui/**` (shadcn/Base UI evolution)                                             | Yes — primary risk area                 |
| `packages/cli`, `packages/project`, `packages/config`, `packages/consent`               | Yes                                     |
| `apps/web`, `apps/reference` (`src/lib`, fixtures, providers)                           | Yes                                     |
| `docs/**`, `docs/_archive/**`                                                           | Yes                                     |
| `templates/**`, `.github/**`, `scripts/**`, `openapi/**`, `.storybook/**`, `.cursor/**` | Yes                                     |
| `public/**`, committed binary assets                                                    | Yes — **none at HEAD**                  |
| `.gitignore`, `.npmrc`, `pnpm-lock.yaml`, `renovate.json`                               | Yes                                     |
| Git LFS (`.gitattributes`)                                                              | **Not used** — no `.gitattributes` file |

### Git history (275 commits)

Risk-based sampling with reproducible commands (see §6). Full line-by-line provenance was **not**
performed for trivial Atlas-authored files.

---

## 2. Current third-party provenance

| Surface                                                                                            | Upstream                     | Classification                                           | License                              | Action                                                             |
| -------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| `packages/ui/src/components/ui/*` (40+ primitives)                                                 | shadcn/ui → `@base-ui/react` | adapted from upstream (shadcn-generated, Atlas-modified) | shadcn MIT; Base UI MIT (dependency) | Attribution in `THIRD_PARTY_NOTICES.md`; regenerate via shadcn CLI |
| `packages/ui` extended primitives (`command`, `chart`, `calendar`, …)                              | shadcn + cmdk/recharts/etc.  | adapted from upstream + dependency-only libs             | MIT / per dependency                 | Dependency inventory; shadcn MIT notice                            |
| `@base-ui/react` imports                                                                           | MUI Base UI                  | dependency-only                                          | MIT                                  | `pnpm licenses:check`                                              |
| `packages/ui` Atlas helpers (`empty-state`, `error-fallback`, `loader`, `form`, `theme-toggle`, …) | Atlas                        | Atlas-authored                                           | Apache-2.0                           | None                                                               |
| `apps/*/src/lib/api/contracts/schema.ts`                                                           | openapi-typescript           | generated                                                | MIT (tool)                           | Header preserved                                                   |
| `apps/*/src/lib/**` (API, auth, CSP, telemetry)                                                    | Atlas (+ framework idioms)   | Atlas-authored                                           | Apache-2.0                           | None                                                               |
| `packages/cli` generators                                                                          | Atlas                        | Atlas-authored templates                                 | Apache-2.0                           | None                                                               |
| Docs archived Radix references                                                                     | shadcn/Radix era docs        | historical-only prose                                    | N/A                                  | Update stale claims (see §3)                                       |
| Fonts (Inter)                                                                                      | Google Fonts via `next/font` | runtime download                                         | OFL (Inter)                          | No bundled font files committed                                    |
| npm dependencies (1246+ packages)                                                                  | npm registry                 | dependency-only                                          | See `pnpm licenses:report`           | Policy in `scripts/license-policy.mjs`                             |

**Distinction:** dependency licenses (`pnpm licenses:check`) ≠ copied-source provenance (this doc +
`THIRD_PARTY_NOTICES.md`).

---

## 3. shadcn / Radix / Base UI

### Current HEAD — shadcn-derived components

Generated/refreshed from shadcn using `packages/ui/components.json` (`style: base-vega`, preset
`bJzBPQGZc`). Evidence: `components.json` schema URL, commit `3099c4b`, `packages/ui/README.md`.

**Base UI primitive wrappers (import `@base-ui/react`, shadcn-generated styling):**

`accordion`, `alert-dialog`, `avatar`, `badge`, `breadcrumb`, `button`, `button-group`, `checkbox`,
`collapsible`, `combobox`, `context-menu`, `dialog`, `drawer`, `dropdown-menu`, `hover-card`,
`input`, `item`, `menubar`, `navigation-menu`, `popover`, `progress`, `radio-group`, `scroll-area`,
`select`, `separator`, `sheet`, `slider`, `switch`, `tabs`, `toggle`, `toggle-group`, `tooltip`

**Extended shadcn components (additional runtime deps, exported from `@atlas/ui/extended`):**

`calendar` (react-day-picker), `carousel` (embla), `chart` (recharts), `command` (cmdk),
`input-otp`, `resizable` (react-resizable-panels)

**Atlas-authored UI (not shadcn templates):**

`alert`, `card`, `empty`, `empty-state`, `error-fallback`, `field`, `form`, `input-group`, `kbd`,
`label`, `loader`, `native-select`, `pagination`, `skeleton`, `sonner` (wrapper), `spinner`,
`table`, `textarea`, `theme-toggle`

**Upstream licenses (verified 2026-08-27):**

| Upstream                                                             | License | Copied into repo?            |
| -------------------------------------------------------------------- | ------- | ---------------------------- |
| [shadcn/ui](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)    | MIT     | Yes — component source       |
| [@base-ui/react](https://github.com/mui/base-ui/blob/master/LICENSE) | MIT     | **No** — npm dependency only |
| Radix (historical)                                                   | MIT     | Historical Git blobs only    |

**Required/prudent notices:** shadcn MIT text in
[`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md). Per-file MIT headers are **not**
duplicated across every component (not required for MIT when a central notice is maintained — legal
review may confirm for your distribution model).

**Apache-2.0 compatibility:** MIT upstream source is compatible with Atlas's Apache-2.0 license
(#19).

### Historical Radix-era source

| Item                        | Detail                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| First Radix-era UI commit   | `abbc212` (`feat: add new UI components and utilities`)                                            |
| Migration to Base UI preset | `3099c4b` (#42)                                                                                    |
| Evidence                    | Pre-migration `dialog.tsx` imported `@radix-ui/react-dialog`; current uses `@base-ui/react/dialog` |
| Classification              | historical-only copied source (shadcn Radix templates)                                             |
| License                     | MIT (Radix + shadcn ecosystem)                                                                     |
| HEAD action                 | None — replaced at source level                                                                    |
| History (#24)               | Blobs remain recoverable if full history is published; MIT-compatible                              |

**Stale documentation:** `docs/how-we-build/accessibility.md` previously claimed Radix primitives at
HEAD — corrected to Base UI. Archived docs under `docs/_archive/` still mention Radix-era setup.

### Base UI — dependency vs copied source

Atlas **does not** copy Base UI implementation source into the repo. Components import
`@base-ui/react/*` as npm dependencies. Copied/adapted material is the **shadcn component shell**
(Tailwind/CVA styling and composition), not Base UI internals.

---

## 4. Assets

### HEAD

`git ls-files` returns **zero** tracked files matching: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`,
`.svg`, `.ico`, `.pdf`, `.woff`, `.woff2`, `.ttf`, `.otf`, `.eot`

No `apps/*/public/**` assets are committed. Favicons/icons are not vendored in-repo.

### Fonts

| Mechanism                  | Location                                                           | Committed files |
| -------------------------- | ------------------------------------------------------------------ | --------------- |
| `next/font/google` (Inter) | `apps/web/src/app/layout.tsx`, `apps/reference/src/app/layout.tsx` | None            |

### Historical binary assets

Ten PNG design-system screenshots under `packages/ui/design-system-screenshots/` (Atlas UI captures,
synthetic — no third-party dashboards). Removed from HEAD; **still in Git history** (largest ~34
KB).

---

## 5. Generated / vendored source

| Generator          | Output                                   | Classification                          |
| ------------------ | ---------------------------------------- | --------------------------------------- |
| shadcn CLI         | `packages/ui/src/components/ui/*`        | generated → adapted                     |
| openapi-typescript | `apps/*/src/lib/api/contracts/schema.ts` | generated                               |
| `@atlas/cli`       | feature/page scaffolds                   | Atlas-generated templates               |
| pnpm / turbo       | lockfiles, `.turbo` (ignored)            | generated — not redistributed as source |

**Vendored upstream directories:** none found (`vendor/`, `third_party/`, etc.).

---

## 6. Historical audit

### Commands executed (reproducible)

```bash
# Repository scale
git rev-list --all --count

# Deleted binary assets by extension
git log --all --diff-filter=D --name-only --pretty=format: | sort -u \
  | grep -E '\.(png|jpg|jpeg|webp|gif|svg|ico|woff|woff2|ttf|otf|pdf)$'

# Largest historical binary blobs
git rev-list --objects --all \
  | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' \
  | awk '/^blob/ && $4 ~ /\.(png|jpg|jpeg|webp|gif|svg|ico|woff|woff2|ttf|otf|pdf)$/ {print $3, $4}' \
  | sort -rn | head -20

# Radix-era UI migration
git log --all -S '@radix-ui/react-dialog' --oneline -- packages/ui
git show abbc212:packages/ui/src/components/ui/dialog.tsx | head

# Copyright / license header search (no third-party headers in UI source)
git grep -l 'Copyright\|SPDX-License-Identifier' $(git rev-list --all) -- ':!LICENSE' ':!THIRD_PARTY_NOTICES.md'

# Client / proprietary naming spot check
git grep -iE 'attio|proprietary|confidential' $(git rev-list --all --max-count=30)

# Secrets spot check (supporting evidence only)
git grep -iE 'sk_live_|Bearer [a-zA-Z0-9]{20,}' $(git rev-list --all --max-count=50) \
  | grep -v test | grep -v mock | grep -v README
```

Automated wrapper: `pnpm provenance:history` → `node scripts/provenance-audit.mjs --history`

### Sampling strategy

1. Prioritized `packages/ui` (current + Radix → Base UI migration).
2. Enumerated all deleted binary paths.
3. Ranked historical blobs by size (only design-system PNGs surfaced).
4. Spot-checked secrets/client naming — no production credentials found; example placeholders only.

---

## 7. History purge candidates (#24)

| Path                                                     | History location                     | Reason                                                                                  | Required #24 action                                               |
| -------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `packages/ui/design-system-screenshots/*.png` (10 files) | Committed then deleted; blobs remain | Low risk (Atlas UI captures) but optional noise for public history                      | **Optional** — purge only if clean history desired; not a blocker |
| —                                                        | —                                    | No proprietary client assets, credentials, or commercial fonts found in sampled history | **`none` required**                                               |

Product/client names appear in `docs/audit/claims-register.md` as **marketing lists**, not copied
client code or assets.

---

## 8. Attribution / notices

| Artifact                                                   | Purpose                                             |
| ---------------------------------------------------------- | --------------------------------------------------- |
| [`LICENSE`](../../LICENSE)                                 | Atlas Apache-2.0 (#19)                              |
| [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md)   | shadcn MIT + historical Radix note + generated code |
| This document                                              | Audit methodology, classifications, purge list      |
| [`license-exceptions.json`](../../license-exceptions.json) | Reviewed dependency license dispositions            |

Upstream per-file copyright headers were **not** present in shadcn-generated components; none were
stripped. No bogus per-file attribution added to Atlas-authored helpers.

---

## 9. Dependency-license inventory

**Data source:** installed package `package.json` manifests under `node_modules/` (hoisted layout
per `.npmrc` `node-linker=hoisted`). Not lockfile metadata alone.

```bash
pnpm install --frozen-lockfile
pnpm licenses:check     # CI gate — fails on unknown/disallowed/unreviewed
pnpm licenses:report    # Summary counts
```

**Policy:** `scripts/license-policy.mjs` — SPDX classifications: `allowed`, `review-required`,
`disallowed`, `unknown`.

**Workspace packages:** `@atlas/*` excluded from third-party enumeration.

Representative HEAD results (2026-08-27 audit):

| Status                                    | Count |
| ----------------------------------------- | ----- |
| allowed                                   | 1246  |
| review-required (reviewed via exceptions) | 13    |
| unknown                                   | 0     |
| disallowed                                | 0     |

---

## 10. Unknown / review-required licenses

All review-required packages at HEAD have explicit entries in
[`license-exceptions.json`](../../license-exceptions.json) (13 packages):

| Package                | Declared license        | Disposition                               |
| ---------------------- | ----------------------- | ----------------------------------------- |
| `harmony-reflect`      | (Apache-2.0 OR MPL-1.1) | Reviewed — transitive dual-license        |
| `@img/sharp-libvips-*` | LGPL-3.0-or-later       | Reviewed — optional native transitive dep |
| `@sentry/cli*`         | FSL-1.1-MIT             | Reviewed — optional dev/build tool        |
| `axe-core`             | MPL-2.0                 | Reviewed — Storybook a11y transitive      |
| `caniuse-lite`         | CC-BY-4.0               | Reviewed — build-time data                |
| `lightningcss*`        | MPL-2.0                 | Reviewed — Tailwind build chain           |
| `posthog-js`           | SEE LICENSE IN LICENSE  | Reviewed — optional adapter               |
| `spawndamnit`          | SEE LICENSE IN LICENSE  | Reviewed — Changesets dev dep             |
| `browser-assert`       | (missing)               | Reviewed — MIT per package LICENSE file   |

---

## 11. Public-release blockers

| Item                                        | Severity                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| Missing Apache-2.0 `LICENSE`                | **Blocker** — resolved at HEAD                                              |
| Unreviewed dependency licenses              | **Blocker** — gated by `pnpm licenses:check`                                |
| shadcn copied source without notice         | **Blocker** — resolved via `THIRD_PARTY_NOTICES.md`                         |
| Historical Radix MIT blobs in history       | **Non-blocker** (MIT-compatible) — document for #24                         |
| Design-system PNGs in history               | **Non-blocker** — optional #24 purge                                        |
| Private npm/git dependencies in lockfile    | **Blocker** — none found (`dependencies:check`)                             |
| Committed proprietary fonts/binaries        | **Blocker** — none at HEAD                                                  |
| Trademark/logo files (GitHub, Vercel, etc.) | **Non-blocker** — none committed; names in docs only                        |
| Final notice wording vs #19                 | **Legal-review item** — Apache-2.0 aligned; counsel may refine NOTICE scope |
| Full history purge of client material       | **#24 cutover item** — none required from this audit                        |

---

## 12. Automated checks

| Command                   | Purpose                                                         |
| ------------------------- | --------------------------------------------------------------- |
| `pnpm licenses:check`     | Dependency license policy                                       |
| `pnpm licenses:report`    | Human-readable inventory summary                                |
| `pnpm provenance:check`   | HEAD: no committed binaries, required docs, no stale Radix deps |
| `pnpm provenance:history` | Print historical audit commands/output                          |
| `pnpm dependencies:check` | Private/git/file dependency sources (#26)                       |
| `pnpm governance:check`   | Apache-2.0 governance (#19)                                     |

Tests: `scripts/__tests__/audit-licenses.test.mjs`

---

## 13. Legal-review boundary

**Engineering judgment (this audit):**

- Classification of shadcn/Base UI/Radix surfaces
- Dependency license enumeration and policy tiers
- Absence of committed binary assets at HEAD
- Identification of historical blobs and optional purge candidates

**Requires qualified legal review:**

- Whether central `THIRD_PARTY_NOTICES.md` satisfies MIT attribution for your distribution model
- FSL / LGPL / MPL dispositions for specific deployment scenarios
- Trademark use of third-party names in public docs/marketing
- Final public-history strategy (#24) if any engagement-specific commits exist outside this sample

---

## 14. Maintenance

When refreshing shadcn primitives:

1. Regenerate from `packages/ui/components.json`.
2. Re-run `pnpm provenance:check` and `pnpm licenses:check`.
3. Update this doc if component classification changes materially.

When adding committed assets: document provenance here **before** merge; binary files require
explicit redistribution basis.

---

## 15. #27 acceptance checklist

| Criterion                                             | Status                                               |
| ----------------------------------------------------- | ---------------------------------------------------- |
| Current source/assets reviewed                        | **PASS**                                             |
| Historical Git blobs searched/sampled                 | **PASS**                                             |
| shadcn/Radix provenance documented                    | **PASS**                                             |
| Required notices preserved                            | **PASS**                                             |
| No proprietary/commercial asset exposed at HEAD       | **PASS**                                             |
| History purge candidates identified                   | **PASS** (`none` required; optional PNG purge noted) |
| Dependency licenses reproducibly enumerable           | **PASS**                                             |
| Unknown/incompatible license disposition explicit     | **PASS**                                             |
| LICENSE/notices consistent with #19                   | **PASS** (Apache-2.0)                                |
| Closing report includes unresolved legal-review items | **PASS** (§13)                                       |

**Merge recommendation:** Safe to merge engineering artifacts; #27 can close after review. #24 still
owns public cutover and any optional history surgery.
