# Atlas Claims Register

**Purpose:** Traceable mapping from material Atlas claims to repository evidence, intended audience,
review status, and follow-up work.

**Maintainers:** Use this register before retaining or strengthening public language. Coding agents
should treat `status: remove` and `status: planned` claims as non-evidence.

**Initial owner:** `@thedanielmark`  
**Created:** 2026-08-16  
**Last full review:** 2026-08-16  
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

Authorized clients receive ordinary source code they can fork and adapt under their engagement or
usage terms.

Does **not** mean publicly downloadable, community-supported, or inspectable by arbitrary visitors.

### Accessible

Atlas provides an accessibility-oriented baseline through semantic components, lint rules, Storybook
tooling, keyboard/focus conventions, and documented manual review.

Does **not** claim formal WCAG conformance or complete automated enforcement until required audits
and CI work exist ([#16](https://github.com/blitzcraftlabs/atlas/issues/16)).

### Secure

Atlas includes documented security controls and secure engineering defaults.

Security is **not** absolute. Distinguish current controls from planned threat modelling, blocking
vulnerability policy, independent review, and consumer-specific obligations
([#14](https://github.com/blitzcraftlabs/atlas/issues/14),
[#20](https://github.com/blitzcraftlabs/atlas/issues/20)).

## Production history

Use these categories exactly. Do not collapse them.

| Category                  | Products                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Built from Atlas**      | Aviatopia; BlitzCraft Studio (Publishing Platform); Ax402 Clients; thedanielmark-site; xgas-station-app; bridge-indexer-frontend |
| **Migrated toward Atlas** | gitmyabi-app; cha-ching-app                                                                                                      |

Chronology and per-product evidence are incomplete in this repository. Do not invent delivery
metrics, client endorsements, dates, or production outcomes.

## Claims

| ID    | Claim (normalized)                                  | Source locations                                                                | Audience               | Approved definition | Evidence category         | Evidence                                                                             | Status    | Known limitations                                                                     | Follow-up                                                                       | Owner          | Last reviewed | Next review |
| ----- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------- | ------------------- | ------------------------- | ------------------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------- | ------------- | ----------- |
| C-001 | Atlas is a forkable frontend platform template      | `README.md`, `docs/public/README.md`                                            | Clients, evaluators    | Forkable            | Repository + access model | Private repo; engagement-based access; `CONTRIBUTING.md`                             | qualified | Not public or anonymously forkable                                                    | [#19](https://github.com/blitzcraftlabs/atlas/issues/19)                        | @thedanielmark | 2026-08-16    | 2026-11-16  |
| C-002 | Fork this repo publicly                             | Former `README.md` wording                                                      | Public                 | Forkable            | Access model              | No public repo access                                                                | remove    | Contradicted access model                                                             | Showcase follow-up                                                              | @thedanielmark | 2026-08-16    | 2026-11-16  |
| C-003 | Atlas is MIT-licensed                               | Former `README.md` License section                                              | Public                 | —                   | License file              | Root [`LICENSE`](../../LICENSE) Apache-2.0; package `license` fields                 | qualified | Public mirror and GitHub license detection follow #24                                 | [#24](https://github.com/blitzcraftlabs/atlas/issues/24)                        | @thedanielmark | 2026-08-19    | 2026-11-16  |
| C-004 | Repository access is engagement-based               | `docs/public/faq.md`, `CONTRIBUTING.md`                                         | Clients, collaborators | Forkable            | Access model              | Private repository; invited collaborators                                            | proven    | Terms per engagement, not public OSS                                                  | [#19](https://github.com/blitzcraftlabs/atlas/issues/19)                        | @thedanielmark | 2026-08-16    | 2026-11-16  |
| C-005 | Atlas does not use `next-themes` for theming        | `docs/public/faq.md`, ADR-0001                                                  | Engineers              | —                   | Implementation            | `packages/ui/src/providers/theme-provider.tsx`, `packages/ui/src/hooks/use-theme.ts` | proven    | Unused `next-themes` dependency removed from `apps/web/package.json` in #13           | —                                                                               | @thedanielmark | 2026-08-16    | 2026-11-16  |
| C-006 | Accessibility violations cause build errors         | `docs/public/capabilities.md`, `docs/public/decisions.md`, `docs/public/faq.md` | Evaluators             | Accessible          | CI + lint config          | `eslint-plugin-jsx-a11y` errors in ESLint; no dedicated a11y CI gate                 | qualified | ESLint blocks many issues; not full WCAG enforcement                                  | [#16](https://github.com/blitzcraftlabs/atlas/issues/16)                        | @thedanielmark | 2026-08-16    | 2026-11-16  |
| C-007 | High unit-test coverage across the platform         | Former `docs/public/faq.md` testing section                                     | Evaluators             | Production-ready    | Test inventory            | ~21 unit/integration files; 1 Playwright spec; UI package thresholds only            | qualified | `@atlas/ui` has Jest thresholds; `@atlas/web` auth/API paths undertested              | [#12](https://github.com/blitzcraftlabs/atlas/issues/12)                        | @thedanielmark | 2026-08-16    | 2026-11-16  |
| C-008 | Atlas is production-ready                           | `docs/public/README.md`, capabilities copy                                      | Evaluators             | Production-ready    | Production history + CI   | Named products; `.github/workflows/ci.yml` gates                                     | qualified | Scope varies by subsystem; not every path has operational runbooks                    | [#18](https://github.com/blitzcraftlabs/atlas/issues/18)                        | @thedanielmark | 2026-08-16    | 2026-11-16  |
| C-009 | Atlas is battle-tested                              | `docs/public/faq.md` (former)                                                   | Evaluators             | Battle-tested       | Production history        | Built-from and migrated-toward product lists                                         | qualified | Product-level evidence not fully published in-repo                                    | [atlas-showcase#11](https://github.com/blitzcraftlabs/atlas-showcase/issues/11) | @thedanielmark | 2026-08-16    | 2026-11-16  |
| C-010 | Atlas runs in production                            | Former FAQ conclusion                                                           | Evaluators             | Battle-tested       | Production history        | Same as C-009                                                                        | qualified | No per-product uptime or defect history in-repo                                       | atlas-showcase#11                                                               | @thedanielmark | 2026-08-16    | 2026-11-16  |
| C-011 | `CONTRIBUTING.md` exists at repository root         | `docs/how-we-build/ci.md`, `AGENTS.md`                                          | Contributors           | —                   | File presence             | `CONTRIBUTING.md`                                                                    | proven    | —                                                                                     | —                                                                               | @thedanielmark | 2026-08-16    | 2026-11-16  |
| C-012 | MSW v2 is the documented mocking API                | Former `docs/how-we-build/testing.md` drift                                     | Engineers              | —                   | Implementation            | `apps/web/src/test/setup/msw.ts` uses MSW v1 `rest` API                              | qualified | Docs now state v1; migration tracked                                                  | MSW v2 migration backlog                                                        | @thedanielmark | 2026-08-16    | 2026-11-16  |
| C-013 | CI enforces UI package coverage thresholds          | `.github/workflows/ci.yml` step label                                           | Engineers              | Production-ready    | CI                        | `pnpm --filter @atlas/ui test:coverage` + `packages/config/jest.config.js`           | proven    | Applies to `@atlas/ui` only, not entire monorepo                                      | [#12](https://github.com/blitzcraftlabs/atlas/issues/12)                        | @thedanielmark | 2026-08-16    | 2026-11-16  |
| C-014 | Security audit fails CI on moderate vulnerabilities | `.github/workflows/security-audit.yml`                                          | Engineers              | Secure              | CI                        | `pnpm audit ... \|\| true` — non-blocking                                            | qualified | Audit is informational until [#14](https://github.com/blitzcraftlabs/atlas/issues/14) | #14                                                                             | @thedanielmark | 2026-08-16    | 2026-11-16  |
| C-015 | Enterprise-grade frontend platform                  | `README.md`, `docs/public/README.md`, `AGENTS.md`                               | Evaluators             | Enterprise-grade    | Architecture + docs + CI  | `docs/how-we-build/**`, ADRs, CI pipeline                                            | qualified | Not third-party certified                                                             | #20                                                                             | @thedanielmark | 2026-08-16    | 2026-11-16  |
| C-016 | Archived docs are non-canonical                     | `docs/_archive/README.md`                                                       | Engineers, agents      | —                   | Documentation policy      | Archive README + link checker archive rule                                           | proven    | Archive may still contain broken historical links                                     | —                                                                               | @thedanielmark | 2026-08-16    | 2026-11-16  |
| C-017 | Internal documentation links are CI-checked         | `package.json` `docs:check`, CI workflow                                        | Maintainers            | Production-ready    | CI + script               | `scripts/check-doc-links.mjs`                                                        | proven    | External URLs optional via `--external`                                               | —                                                                               | @thedanielmark | 2026-08-16    | 2026-11-16  |
| C-018 | Atlas repository licensed Apache-2.0                | `LICENSE`, `package.json`, governance doc                                       | Clients, evaluators    | —                   | License file              | Apache-2.0 [`LICENSE`](../../LICENSE); not public until #24                          | qualified | License decision ≠ public repository availability                                     | [#24](https://github.com/blitzcraftlabs/atlas/issues/24)                        | @thedanielmark | 2026-08-19    | 2026-11-16  |
| C-019 | Atlas platform snapshot is the versioned product    | Governance doc, changeset fixed group                                           | Maintainers            | —                   | Release governance        | `docs/how-we-build/releases-and-governance.md`; `.changeset/config.json`             | qualified | Workspace versions mirror Atlas; not independent npm products                         | —                                                                               | @thedanielmark | 2026-08-19    | 2026-11-16  |
| C-020 | Canonical Atlas release tags use `vX.Y.Z`           | Governance doc, `scripts/validate-governance.mjs`                               | Maintainers            | —                   | Release governance        | Tag policy; no `@atlas/ui@` workflow paths                                           | qualified | Tags not published until #24                                                          | [#24](https://github.com/blitzcraftlabs/atlas/issues/24)                        | @thedanielmark | 2026-08-19    | 2026-11-16  |
| C-021 | Workspace packages are internal/private             | `package.json` in workspaces                                                    | Engineers              | —                   | Package metadata          | All workspace packages `private: true`                                               | proven    | Not independently supported npm products                                              | —                                                                               | @thedanielmark | 2026-08-19    | 2026-11-16  |
| C-022 | Release automation does not publish before #24      | `.github/workflows/release.yml`                                                 | Maintainers            | —                   | CI                        | No `publish:` step; no tag/release creation in workflow                              | proven    | Version PR only; publication deferred                                                 | [#24](https://github.com/blitzcraftlabs/atlas/issues/24)                        | @thedanielmark | 2026-08-19    | 2026-11-16  |
| C-023 | GitHub Release exists for current Atlas version     | GitHub Releases UI                                                              | Public                 | —                   | Release artifact          | No canonical `vX.Y.Z` GitHub Release published                                       | planned   | First publication is #24 scope                                                        | [#24](https://github.com/blitzcraftlabs/atlas/issues/24)                        | @thedanielmark | 2026-08-19    | 2026-11-16  |
| C-024 | Release rehearsal verified in GitHub Actions        | `release.yml` `workflow_dispatch`, `pnpm release:rehearse`                      | Maintainers            | Production-ready    | CI + script               | Local rehearsal script; Actions dry-run after merge pending                          | planned   | Do not mark verified until post-merge workflow_dispatch succeeds                      | [#19](https://github.com/blitzcraftlabs/atlas/issues/19)                        | @thedanielmark | 2026-08-19    | 2026-11-16  |
| C-025 | Release governance validated in CI                  | `package.json` `governance:check`, CI Governance job                            | Maintainers            | —                   | CI + script               | `scripts/validate-governance.mjs`                                                    | proven    | Separate from `docs:check` link checker                                               | —                                                                               | @thedanielmark | 2026-08-19    | 2026-11-16  |

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
