# Contributing to Atlas

Atlas is a **forkable frontend platform template** for selected clients, invited collaborators, and
authorized evaluators. The source repository is private; access and usage terms are provided as part
of an engagement or evaluation—not as a general public open-source offering.

This guide is for Atlas maintainers, invited collaborators, client engineers, and future public
contributors if the access model changes.

## Repository purpose and access

- **Maintainers** own platform direction, releases, and canonical documentation.
- **Invited collaborators** contribute through agreed scopes (features, fixes, reviews).
- **Client engineers** fork or branch under engagement terms and may upstream fixes with provenance.
- **Evaluators** may receive read access for technical due diligence; public docs at `docs/public/`
  describe behavior without granting source access.

Licensing and permanent public-access policy are tracked in
[Releases and Governance](docs/how-we-build/releases-and-governance.md) and issue
[#24](https://github.com/blitzcraftlabs/atlas/issues/24) (public cutover). Atlas is **licensed under
Apache-2.0**; the repository may remain private until #24 completes.

Canonical engineering guidance:

| Document                                                              | Use for                                           |
| --------------------------------------------------------------------- | ------------------------------------------------- |
| [AGENTS.md](AGENTS.md)                                                | Coding agents and day-to-day implementation rules |
| [docs/how-we-build/](docs/how-we-build/README.md)                     | Platform conventions                              |
| [docs/public/](docs/public/README.md)                                 | External-facing capability descriptions           |
| [docs/adr/](docs/adr/README.md)                                       | Significant technical decisions                   |
| [docs/audit/claims-register.md](docs/audit/claims-register.md)        | Material claims and evidence                      |
| [Releases & Governance](docs/how-we-build/releases-and-governance.md) | Versioning, licensing, releases, support          |

**Do not** treat `docs/_archive/` as current implementation guidance (see
`docs/_archive/README.md`).

## Prerequisites

- Node.js **>= 22**
- pnpm **>= 10** (`corepack enable`)

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm validate:env
pnpm dev
```

## Branch and worktree practices

- Branch from `main` using conventional prefixes: `feat/`, `fix/`, `docs/`, `chore/`, `refactor/`.
- Keep pull requests focused; prefer multiple small PRs over one large mixed change.
- Use a separate worktree when parallel work would conflict with local experiments:

```bash
git fetch origin main
git worktree add ../atlas-my-feature -b feat/my-feature origin/main
```

- Do not force-push to `main`.
- Preserve unrelated local branches and uncommitted work when switching tasks.

## Commit conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
docs: align FAQ with accessibility enforcement evidence
fix(web): handle expired OAuth state
chore: update pnpm lockfile
```

- One logical change per commit when practical.
- Let pre-commit hooks run; do not skip hooks unless explicitly agreed with a maintainer.

## Pull request expectations

1. Link the relevant GitHub issue.
2. Update documentation when behavior, capabilities, or CI gates change.
3. Update [claims register](docs/audit/claims-register.md) when public claims change.
4. Add or update an ADR for significant architectural decisions (see below).
5. Describe validation commands run and their results.
6. Note downstream-fix provenance when porting a fix from a client product fork.

Use the [pull request template](.github/pull_request_template.md) and
[review checklist](.github/PULL_REQUEST_REVIEW_CHECKLIST.md).

## Required validation

Minimum bar before requesting review:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

Also run when your change touches the affected areas:

| Change type                     | Additional commands                                      |
| ------------------------------- | -------------------------------------------------------- |
| Security / CI workflows         | `pnpm security:check` and `pnpm security:workflow-check` |
| Documentation / Markdown links  | `pnpm docs:check`                                        |
| Release governance              | `pnpm governance:check`                                  |
| Formatting                      | `pnpm format` or `pnpm format:write`                     |
| Build-affecting code            | `pnpm build`                                             |
| User-facing flows               | `pnpm --filter @atlas/web test:e2e`                      |
| Shared UI / auth / API coverage | `pnpm test:risk-coverage`                                |

CI runs internal documentation link checks on every pull request. External URL checks are optional
locally: `pnpm docs:check --external`.

## Documentation updates

- Public capability claims must map to evidence in the
  [claims register](docs/audit/claims-register.md).
- Follow [documentation policy](docs/how-we-build/documentation-policy.md).
- Canonical docs must not link into `docs/_archive/` except from audit notes that explicitly discuss
  history.
- Planned work belongs in issues and ADRs—not as if it were shipped.

## Changesets and release impact

Atlas versions the **repository/platform snapshot** as one pre-1.0 line. Changesets collect release
metadata and open **Version PRs** — they do **not** publish npm packages or create GitHub Releases
until [#24](https://github.com/blitzcraftlabs/atlas/issues/24).

Canonical policy: [Releases and Governance](docs/how-we-build/releases-and-governance.md).

- Add a changeset when your change should appear in the Atlas changelog or receive a version bump.
- Workspace packages are `private`; they share the Atlas version and are not independent npm
  products.
- **Pre-1.0 bump convention:**
  - **patch** — bug fixes and small non-breaking work (`0.1.0 → 0.1.1`)
  - **minor** — features and **breaking changes** (`0.1.0 → 0.2.0`)
  - do **not** use **major** in changesets unless maintainers are deliberately releasing `1.0.0`
- Breaking changes require migration notes in the changeset body and changelog; add
  `docs/migrations/` guides when steps are non-trivial.

```bash
pnpm changeset
pnpm changeset:status
pnpm governance:check   # when touching release/licensing files
pnpm release:rehearse     # optional; isolated version transformation dry-run
```

## Security reporting

- **Do not** open public issues for unpatched security vulnerabilities.
- Report suspected vulnerabilities to the repository maintainer through the agreed engagement or
  security channel.
- Do not commit secrets, `.env.local`, or credentials. Gitleaks runs in CI.
- Consumer applications own their deployment hardening, WAF rules, and data classification.

## Accessibility expectations

- Use semantic HTML, labels, keyboard support, and visible `focus-visible` styles.
- Fix `eslint-plugin-jsx-a11y` violations before merge.
- Manually exercise keyboard flows for interactive UI; use Storybook a11y addon for components.
- Formal WCAG conformance and CI enforcement are tracked in
  [#16](https://github.com/blitzcraftlabs/atlas/issues/16).

## ADR requirements

Create an ADR in `docs/adr/` when you:

- choose a library over alternatives for a cross-cutting concern;
- establish a pattern the whole platform must follow;
- deprecate or replace an existing pattern;
- make a decision that is hard to reverse.

Use [ADR-0000 template](docs/adr/0000-template.md). Submit the ADR with the implementation in the
same PR when possible.

## Downstream fixes and upstreaming

Client forks may land fixes before the platform template. When upstreaming:

1. Record the originating product and symptom in the PR description.
2. Prefer platform-level fixes over product-specific workarounds.
3. Link related issues in Atlas and the client repository when available.
4. Do not include client secrets, proprietary URLs, or private customer data.

Upgrade and propagation policy: [#17](https://github.com/blitzcraftlabs/atlas/issues/17).

## Coding agents

[AGENTS.md](AGENTS.md) is authoritative for automated coding agents working in this repository.
Agents must:

- use `@/lib/api` and feature-module patterns—not raw `fetch()` in UI layers;
- use `useConfig()` / `getServerConfig()`—not `process.env`;
- handle loading, empty, error, and success states;
- run relevant validation before claiming completion.

If agent instructions conflict with `docs/_archive/`, **AGENTS.md and current docs win**.

## Maintainer vs client differences

| Topic         | Maintainers                          | Client engineers                                               |
| ------------- | ------------------------------------ | -------------------------------------------------------------- |
| Merge rights  | Yes, per CODEOWNERS                  | Via PR to client fork; upstream by agreement                   |
| Public claims | Must update claims register          | Should not change public positioning without maintainer review |
| ADRs          | Required for platform decisions      | Optional in fork; upstream significant decisions               |
| Release tags  | Own platform releases                | Own product release cadence                                    |
| Showcase copy | Coordinate via atlas-showcase issues | N/A                                                            |

## Questions

Open a discussion with the maintainer through the engagement channel, or file a GitHub issue for
non-sensitive platform work.
