# Atlas Claims Register

**Purpose:** Traceable mapping from material Atlas claims to repository evidence, intended audience,
review status, and follow-up work.

**Maintainers:** Use this register before retaining or strengthening public language. Coding agents
should treat `status: remove` and `status: planned` claims as non-evidence.

**Initial owner:** `@thedanielmark`  
**Created:** 2026-08-16  
**Last full review:** 2026-09-11  
**Next full review:** 2026-11-16 (quarterly)

## Review policy

Review this register when a pull request changes any of:

- public capabilities or positioning (`README.md`, `docs/public/**`, package metadata);
- CI gate names, comments, or enforcement behavior;
- Atlas Showcase copy shared with this repository;
- approved terminology definitions below.

Also complete a **full review quarterly**, and **before every tagged Atlas release**.

Record `last_reviewed` on every touched claim row. A future script or agent can flag rows where
`next_review` is in the past or `last_reviewed` predates linked source changes.

## Approved terminology

These terms remain in Atlas documentation when used with the definitions below.

### Enterprise-grade

Atlas is engineered for team-scale ownership, documented boundaries, automated verification,
security controls, maintainable handover, and controlled evolution.

Does **not** imply certification, unlimited scale, enterprise support contracts, or suitability for
every regulated environment.

### Production-ready

A documented Atlas capability may be called production-ready when it:

- has an identified supported scope;
- passes applicable build, test, security, and release gates;
- has required configuration documented;
- exposes known limitations and consumer responsibilities;
- can be deployed and operated through a documented path.

One production-ready subsystem does **not** prove every Atlas subsystem meets the same standard.

### Battle-tested

Atlas has been exercised through real products and downstream engineering feedback.

Support using the approved product categories in [Production history](#production-history). Does
**not** imply every capability ran in every product or that no production defects occurred.

### Forkable

Anyone can clone or fork the public repository under Apache License 2.0.

Does **not** mean npm-published packages, a support SLA, or independently supported workspace
packages.

### Accessible

Atlas provides an accessibility-oriented baseline through semantic components, ESLint `jsx-a11y`,
Storybook axe/interaction gates on critical compositions, cross-browser keyboard checks, and
documented manual review.

Does **not** claim formal WCAG conformance or certification.

### Secure

Atlas includes documented security controls and secure engineering defaults.

Security is **not** absolute. Distinguish current blocking vulnerability policy and threat model
from independent review, certification, and consumer-specific obligations. Atlas does not currently
publish production SLO, incident-response, or third-party certification evidence.

## Production history

Use these categories exactly. Do not collapse them.

| Category                  | Products                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Built from Atlas**      | Aviatopia; BlitzCraft Studio (Publishing Platform); Ax402 Clients; thedanielmark-site; xgas-station-app; bridge-indexer-frontend |
| **Migrated toward Atlas** | gitmyabi-app; cha-ching-app                                                                                                      |

Chronology and per-product evidence are incomplete in this repository. Do not invent delivery
metrics, client endorsements, dates, or production outcomes.

## Claims

| ID    | Claim (normalized)                                       | Source locations                                                                | Audience             | Approved definition | Evidence category         | Evidence                                                                                                                                             | Status    | Known limitations                                                          | Follow-up                                                                | Owner          | Last reviewed | Next review |
| ----- | -------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------- | ------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------- | ------------- | ----------- |
| C-001 | Atlas is a forkable frontend platform template           | `README.md`, `docs/public/README.md`                                            | Public, contributors | Forkable            | Repository + access model | Public GitHub repository [`blitzcraftlabs/atlas`](https://github.com/blitzcraftlabs/atlas); Apache-2.0 [`LICENSE`](../../LICENSE); `CONTRIBUTING.md` | proven    | Workspace packages are unpublished npm internals                           | —                                                                        | @thedanielmark | 2026-09-11    | 2026-11-16  |
| C-002 | Fork this repo publicly                                  | `README.md`, `CONTRIBUTING.md`                                                  | Public               | Forkable            | Access model              | Unauthenticated clone/fork of [`blitzcraftlabs/atlas`](https://github.com/blitzcraftlabs/atlas)                                                      | proven    | License terms still apply; no npm-published packages                       | —                                                                        | @thedanielmark | 2026-09-11    | 2026-11-16  |
| C-003 | Atlas is MIT-licensed                                    | Former `README.md` License section                                              | Public               | —                   | License file              | Root [`LICENSE`](../../LICENSE) is Apache-2.0; package metadata uses Apache-2.0                                                                      | remove    | Historical README wording was incorrect/superseded                         | —                                                                        | @thedanielmark | 2026-09-11    | 2026-11-16  |
| C-004 | Repository access is engagement-based                    | Former `docs/public/faq.md`, former `CONTRIBUTING.md`                           | Public               | Forkable            | Access model              | Public Apache-2.0 repository; clone/fork permitted                                                                                                   | remove    | Superseded by public OSS access                                            | —                                                                        | @thedanielmark | 2026-09-11    | 2026-11-16  |
| C-005 | Atlas does not use `next-themes` for theming             | `docs/public/faq.md`, ADR-0001                                                  | Engineers            | —                   | Implementation            | `packages/ui/src/providers/theme-provider.tsx`, `packages/ui/src/hooks/use-theme.ts`                                                                 | proven    | Unused `next-themes` dependency is absent from `apps/web/package.json`     | —                                                                        | @thedanielmark | 2026-09-11    | 2026-11-16  |
| C-006 | Accessibility violations cause build errors              | `docs/public/capabilities.md`, `docs/public/decisions.md`, `docs/public/faq.md` | Public               | Accessible          | CI + lint config          | ESLint jsx-a11y errors; Storybook axe on `critical` stories in UI Quality workflow                                                                   | qualified | ESLint + representative Storybook axe; not full WCAG or every story        | —                                                                        | @thedanielmark | 2026-09-11    | 2026-11-16  |
| C-007 | High unit-test coverage across the platform              | Former `docs/public/faq.md` testing section                                     | Public               | Production-ready    | Test inventory            | Risk-based subsystem floors via `pnpm test:risk-coverage`; not repo-wide 80%                                                                         | qualified | Codecov is reporting; local coverage policy is the blocking gate           | [testing.md](../how-we-build/testing.md), `coverage-policy.json`         | @thedanielmark | 2026-09-11    | 2026-11-16  |
| C-008 | Atlas is production-ready                                | `docs/public/README.md`, capabilities copy                                      | Public               | Production-ready    | Production history + CI   | Named products; `.github/workflows/ci.yml` gates                                                                                                     | qualified | Scope varies by subsystem; Atlas does not publish SLO or incident evidence | —                                                                        | @thedanielmark | 2026-09-11    | 2026-11-16  |
| C-009 | Atlas is battle-tested                                   | `docs/public/faq.md` (former)                                                   | Evaluators           | Battle-tested       | Production history        | Built-from and migrated-toward product lists                                                                                                         | qualified | Product-level evidence not fully published in-repo                         | [claims-register.md](claims-register.md#production-history)              | @thedanielmark | 2026-09-11    | 2026-11-16  |
| C-010 | Atlas runs in production                                 | Former FAQ conclusion                                                           | Evaluators           | Battle-tested       | Production history        | Same as C-009                                                                                                                                        | qualified | No per-product uptime or defect history in-repo                            | [claims-register.md](claims-register.md#production-history)              | @thedanielmark | 2026-09-11    | 2026-11-16  |
| C-011 | `CONTRIBUTING.md` exists at repository root              | `docs/how-we-build/ci.md`, `AGENTS.md`                                          | Contributors         | —                   | File presence             | `CONTRIBUTING.md`                                                                                                                                    | proven    | —                                                                          | —                                                                        | @thedanielmark | 2026-08-16    | 2026-11-16  |
| C-012 | MSW v2 is the documented mocking API                     | Former `docs/how-we-build/testing.md` drift                                     | Engineers            | —                   | Implementation            | `apps/web/src/test/setup/msw.ts` uses MSW v1 `rest` API                                                                                              | qualified | Docs now state v1; migration tracked                                       | MSW v2 migration backlog                                                 | @thedanielmark | 2026-08-16    | 2026-11-16  |
| C-013 | CI enforces critical subsystem coverage                  | `.github/workflows/ci.yml` “Enforce critical subsystem coverage”                | Engineers            | Production-ready    | CI                        | `pnpm test:risk-coverage` + `coverage-policy.json`                                                                                                   | proven    | Codecov upload is non-blocking reporting                                   | [testing.md](../how-we-build/testing.md)                                 | @thedanielmark | 2026-09-11    | 2026-11-16  |
| C-014 | Security audit fails CI on HIGH/CRITICAL vulnerabilities | `.github/workflows/security-audit.yml`, `pnpm security:check`                   | Engineers            | Secure              | CI                        | Atlas policy evaluator; HIGH fixture fails; moderate is reported non-blocking                                                                        | proven    | `pnpm audit` is not complete application security                          | —                                                                        | @thedanielmark | 2026-08-29    | 2026-11-16  |
| C-015 | Enterprise-grade frontend platform                       | `README.md`, `docs/public/README.md`, `AGENTS.md`                               | Public               | Enterprise-grade    | Architecture + docs + CI  | `docs/how-we-build/**`, ADRs, CI pipeline                                                                                                            | qualified | Not third-party certified                                                  | —                                                                        | @thedanielmark | 2026-09-11    | 2026-11-16  |
| C-016 | Archived docs are non-canonical                          | `docs/_archive/README.md`                                                       | Engineers, agents    | —                   | Documentation policy      | Archive README + link checker archive rule                                                                                                           | proven    | Archive may still contain broken historical links                          | —                                                                        | @thedanielmark | 2026-08-16    | 2026-11-16  |
| C-017 | Internal documentation links are CI-checked              | `package.json` `docs:check`, CI workflow                                        | Maintainers          | Production-ready    | CI + script               | `scripts/check-doc-links.mjs`                                                                                                                        | proven    | External URLs optional via `--external`                                    | —                                                                        | @thedanielmark | 2026-08-16    | 2026-11-16  |
| C-018 | Atlas repository licensed Apache-2.0                     | `LICENSE`, `package.json`, governance doc                                       | Public               | —                   | License file              | Apache-2.0 [`LICENSE`](../../LICENSE); public GitHub repository                                                                                      | proven    | License does not imply GitHub Release or npm publication                   | —                                                                        | @thedanielmark | 2026-09-11    | 2026-11-16  |
| C-019 | Atlas platform snapshot is the versioned product         | Governance doc, changeset fixed group                                           | Maintainers          | —                   | Release governance        | `docs/how-we-build/releases-and-governance.md`; `.changeset/config.json`                                                                             | qualified | Workspace versions mirror Atlas; not independent npm products              | —                                                                        | @thedanielmark | 2026-08-19    | 2026-11-16  |
| C-020 | Canonical Atlas release tags use `vX.Y.Z`                | Governance doc, `scripts/validate-governance.mjs`                               | Maintainers          | —                   | Release governance        | Tag policy; no `@atlas/ui@` workflow paths                                                                                                           | qualified | Git tags are not created by current automation                             | [releases-and-governance.md](../how-we-build/releases-and-governance.md) | @thedanielmark | 2026-09-11    | 2026-11-16  |
| C-021 | Workspace packages are internal/private                  | `package.json` in workspaces                                                    | Engineers            | —                   | Package metadata          | All workspace packages `private: true`                                                                                                               | proven    | Not independently supported npm products                                   | —                                                                        | @thedanielmark | 2026-08-19    | 2026-11-16  |
| C-022 | Release automation does not publish GitHub Releases      | `.github/workflows/release.yml`                                                 | Maintainers          | —                   | CI                        | No `publish:` step; no tag/release creation in workflow                                                                                              | proven    | Version PR only; GitHub Release publication not enabled                    | [releases-and-governance.md](../how-we-build/releases-and-governance.md) | @thedanielmark | 2026-09-11    | 2026-11-16  |
| C-023 | GitHub Release exists for current Atlas version          | GitHub Releases UI                                                              | Public               | —                   | Release artifact          | No canonical `vX.Y.Z` GitHub Release published                                                                                                       | planned   | Version PRs update changelog; Release publication is not enabled           | [releases-and-governance.md](../how-we-build/releases-and-governance.md) | @thedanielmark | 2026-09-11    | 2026-11-16  |
| C-024 | Release rehearsal verified in GitHub Actions             | `release.yml` `workflow_dispatch`, `pnpm release:rehearse`                      | Maintainers          | Production-ready    | CI + script               | Local rehearsal script; Actions dry-run after merge pending                                                                                          | planned   | Do not mark verified until post-merge workflow_dispatch succeeds           | `.github/workflows/release.yml`                                          | @thedanielmark | 2026-09-11    | 2026-11-16  |
| C-025 | Release governance validated in CI                       | `package.json` `governance:check`, CI Governance job                            | Maintainers          | —                   | CI + script               | `scripts/validate-governance.mjs`                                                                                                                    | proven    | Separate from `docs:check` link checker                                    | —                                                                        | @thedanielmark | 2026-08-19    | 2026-11-16  |

## Status legend

| Status        | Meaning                                                                    |
| ------------- | -------------------------------------------------------------------------- |
| **proven**    | Claim matches inspectable repository evidence within stated scope          |
| **qualified** | Claim may be used only with the approved definition and listed limitations |
| **planned**   | Work is tracked; claim must not be presented as present evidence           |
| **remove**    | Claim contradicted evidence; delete or replace in docs                     |

## Related documents

- [Atlas consistency audit](atlas-consistency-audit.md)
- [Showcase follow-up audit](showcase-follow-up.md)
- [Documentation policy](../how-we-build/documentation-policy.md)
- [Releases and governance](../how-we-build/releases-and-governance.md)
- [CONTRIBUTING.md](../../CONTRIBUTING.md)
