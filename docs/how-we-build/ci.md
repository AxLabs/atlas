# Continuous Integration

Atlas ships a single portable CI workflow (`.github/workflows/ci.yml`) that runs on **GitHub-hosted
runners by default**. Teams with a self-hosted fleet can opt in without replacing workflow files.

## Pipeline layout

```text
pull_request / push to main
  ├── Governance         (licenses, provenance, dependency ownership)
  ├── CI                 (path filter → one install → quality → build → E2E)
  ├── UI Quality         (Storybook build, axe/interaction, visual regression; github-hosted)
  ├── Secrets Scan       (Gitleaks digest-pinned; parallel)
  └── Security Audit     (blocking Atlas vulnerability policy + workflow pins)
```

| Job                | When it runs                                                                                             | What it does                                                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Governance**     | Always                                                                                                   | License, provenance, and dependency-ownership gates                                                                                                                        |
| **CI**             | Always (shell checks); full suite when `app=true` or push to `main`; clean-room when `distribution=true` | Change detection, lockfile policy, `validate:env`, format, lint, typecheck, tests, `test:risk-coverage`, Codecov report, `distribution:verify`, build, Chromium+WebKit E2E |
| **UI Quality**     | When UI-impacting paths change or push to `main`                                                         | Storybook build, critical-story policy, `test:storybook`, Chromium+WebKit keyboard checks, Playwright visual baselines (`ubuntu-24.04`)                                    |
| **Secrets Scan**   | Always                                                                                                   | Gitleaks Docker scan on `ubuntu-latest` (immutable digest)                                                                                                                 |
| **Security Audit** | Always (also weekly cron)                                                                                | Full `pnpm audit --json` evaluated by Atlas policy (HIGH/CRITICAL block)                                                                                                   |

**Docs-only PRs** still run Node setup and `pnpm docs:check` (via
`node scripts/check-doc-links.mjs`). They skip install, lint, typecheck, tests, build, and E2E after
the lightweight policy checks. Packaged bootstrap docs, CLI/runtime, starter app, and generated
consumer sources set `distribution=true` and run `pnpm distribution:verify` inside the required
**CI** job. That step is not skipped for affected Distribution v1 changes.

**Push to `main`** always runs the full suite.

## Local parity

Run the same checks before opening a PR:

```bash
pnpm install --frozen-lockfile
pnpm docs:check
pnpm validate:env
pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm test:risk-coverage
pnpm distribution:verify
pnpm build
pnpm --filter @atlas/web test:e2e
pnpm --filter @atlas/reference test:e2e
pnpm --filter @atlas/ui test:ui-quality
```

Minimum bar (matches `CONTRIBUTING.md`):

```bash
pnpm lint && pnpm typecheck && pnpm test
```

## Composite actions

| Action                      | Purpose                                                                    |
| --------------------------- | -------------------------------------------------------------------------- |
| `setup-atlas-ci`            | Node 22 + pnpm; GitHub Actions pnpm cache or self-hosted persistent stores |
| `setup-ci-node`             | Self-hosted Node/pnpm setup with persistent `/var/cache/ci` stores         |
| `run-ci-suite`              | Shared CI checks for GitHub-hosted and trusted self-hosted paths           |
| `run-ui-quality-suite`      | Shared Storybook, accessibility, and visual regression checks              |
| `run-bundle-analysis-suite` | Shared bundle size analysis and budget checks                              |
| `cleanup-self-hosted-job`   | Clears per-job temp HOME on self-hosted runners                            |

## GitHub-hosted (default)

No configuration required. `setup-atlas-ci` uses `actions/setup-node` with `cache: pnpm`.

Optional: set [Turbo remote cache](https://turbo.build/repo/docs/core-concepts/remote-caching)
secrets (`TURBO_TOKEN`, `TURBO_TEAM`) in the repository if your team uses Vercel remote caching.

Trusted self-hosted migration is staged in two phases. See
[ci-trusted-runner-migration.md](ci-trusted-runner-migration.md) before enabling the organization
runner-group allowlist.

## Self-hosted runners (opt-in maintainer acceleration)

Atlas defaults to **GitHub-hosted** runners. No repository variables, runner groups, or BlitzCraft
infrastructure are required for forks or downstream consumers.

BlitzCraft Labs may opt into a persistent self-hosted fleet as a performance optimization for
**trusted same-repository work** (pushes to `main` and maintainer PRs where
`head.repo.full_name == github.repository`). External fork PRs always stay on GitHub-hosted runners,
even when `ATLAS_CI_RUNNER_PROFILE=self-hosted`.

### Architecture

Only one workflow may target the trusted runner group directly:

`.github/workflows/trusted-self-hosted.yml`

Callers pin the reusable workflow with the GitHub Actions caller ref:

`blitzcraftlabs/atlas/.github/workflows/trusted-self-hosted.yml@main`

The organization runner-group workflow allowlist is a different GitHub format and must remain:

`blitzcraftlabs/atlas/.github/workflows/trusted-self-hosted.yml@refs/heads/main`

The reusable workflow enforces the fork trust gate internally; callers also compute
`ATLAS_CI_USE_SELF_HOSTED` from `vars`/`github` so fork PRs never invoke the trusted path. Atlas
does not use `pull_request_target` to execute untrusted PR code.

| Workflow / job family | GitHub-hosted fallback             | May use trusted self-hosted |
| --------------------- | ---------------------------------- | --------------------------- |
| **CI**                | Fork PRs and github-hosted profile | Trusted same-repo work only |
| **UI Quality**        | Fork PRs and github-hosted profile | Trusted same-repo work only |
| **Bundle Analysis**   | Fork PRs and github-hosted profile | Trusted same-repo work only |
| **Governance**        | Always                             | No                          |
| **Secrets Scan**      | Always                             | No                          |
| **Security Audit**    | Always                             | No                          |
| **Release**           | Always                             | No                          |

### Enable

```bash
pnpm ci:self-hosted:enable
```

Set repository variables (Settings → Actions → Variables):

| Name                      | Value                     | Required |
| ------------------------- | ------------------------- | -------- |
| `ATLAS_CI_RUNNER_PROFILE` | `self-hosted`             | Yes      |
| `ATLAS_CI_RUNNER_GROUP`   | unset (optional override) | Optional |

Register runners in the `Blitzcraft Trusted CI` runner group with the `ci` capability label.
`ATLAS_CI_RUNNER_GROUP` is optional; the trusted workflow defaults to `Blitzcraft Trusted CI`. The
group is shared with selected private BlitzCraft CI workflows; Atlas reaches it only through the
main-pinned reusable workflow. Turing capacity is two runners (`turing-ci-1`, `turing-ci-2`).
Bootstrap each host:

```bash
sudo mkdir -p /var/cache/ci
sudo chown -R <runner-user>:<runner-user> /var/cache/ci
```

Downstream organizations may configure their own runner infrastructure independently; Atlas does not
assume access to BlitzCraft runner groups, secrets, or host paths.

### Execution details

Self-hosted E2E and UI visual checks run inside the matching `mcr.microsoft.com/playwright` Docker
image so Chromium and WebKit system libraries are available without `sudo apt-get` in CI jobs (the
runner user cannot elevate for `playwright install --with-deps`). GitHub-hosted CI installs both
required browsers explicitly. Playwright configs define the same projects locally and in CI. Web and
reference suites run sequentially in one container to reduce runner disk pressure. Installs on
self-hosted runners materialize host-only optional dependencies (`linux`/`x64` override); the
Governance job on `ubuntu-latest` still installs the full Atlas-supported architecture set for
deterministic license auditing. The container runs as the host runner user
(`--user "$(id -u):$(id -g)"`) so Playwright and Next.js artifacts written through the bind-mounted
workspace are not owned by root. pnpm is invoked via `corepack pnpm` from the repository root so
Corepack honors the repo's `packageManager` field without `corepack enable`. Playwright's dev server
command uses `corepack pnpm dev` so the webServer subprocess can resolve pnpm inside the container.
Ensure Docker is installed and the runner user can run containers. Atlas workflows do not mount the
host Docker socket into jobs.

Trusted self-hosted Atlas CI must execute the checked-out repository directly from
`${{ github.workspace }}`, matching GitHub-hosted workspace semantics. Self-hosted differences are
limited to infrastructure concerns such as persistent caches and Playwright Docker execution. A
small pre-checkout repair step can chown root-owned leftovers in the runner work directory so
`actions/checkout` can clean the default workspace; it must not introduce nested checkout
directories. Persistent stores remain:

| Variable          | Default path                            |
| ----------------- | --------------------------------------- |
| `PNPM_STORE_DIR`  | `/var/cache/ci/pnpm-store/<owner-repo>` |
| `TURBO_CACHE_DIR` | `/var/cache/ci/turbo/<owner-repo>`      |

Example for `blitzcraftlabs/atlas`:

```text
/var/cache/ci/pnpm-store/blitzcraftlabs-atlas/
/var/cache/ci/turbo/blitzcraftlabs-atlas/
```

Override the root with `CI_CACHE_ROOT` on the runner host. GitHub-hosted runs continue to use
`actions/setup-node` caching.

`pnpm security:workflow-check` fails if another workflow targets the trusted runner group, omits the
fork trust gate, or removes the GitHub-hosted fallback path.

To revert: delete `ATLAS_CI_RUNNER_PROFILE` (or set `github-hosted`). See
`tools/ci-self-hosted/README.md`.

## What Atlas does not ship in default CI

These are **consumer-app** concerns, not reference-platform defaults:

- Pre-seeded Postgres images or `pg_dump` artifacts
- Content-audit or DB-backed link checks

Add those in your product repo when you have a real database and content pipeline. Aviatopia's
`infra/docker/scripts/` is a reference implementation.

## Optional workflows

| Workflow              | Purpose                                                                            | Enable                                                                    |
| --------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `security-audit.yml`  | Blocking Atlas vulnerability policy + workflow pin checks                          | On by default (PRs, `main`, weekly)                                       |
| `perf-lighthouse.yml` | Lighthouse CI budgets                                                              | `pnpm perf:enable`                                                        |
| `perf-bundle.yml`     | Bundle size analysis                                                               | `pnpm perf:enable`                                                        |
| `release.yml`         | Version PR, GitHub Release, and npm Trusted Publishing for `@blitzcraftlabs/atlas` | On `main`; `workflow_dispatch` is rehearsal-only and does not publish npm |

Performance budget details live in `tools/perf/README.md` when workflows are enabled.

## Testing CI changes

### 1. Local (fastest)

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm test
pnpm build
```

### 2. Path filter behavior

```bash
# Docs-only change should skip heavy jobs once CI runs on GitHub
git checkout -b test/ci-docs-only
echo "note" >> docs/how-we-build/ci.md
git add docs/how-we-build/ci.md && git commit -m "docs: ci note"
git push -u origin test/ci-docs-only
# Open PR → CI runs policy checks only; install, build, and E2E skipped
```

```bash
# App change should run full suite
git checkout -b test/ci-app-change
# touch apps/web/src/app/page.tsx, commit, push, open PR
```

### 3. On GitHub Actions

Push a branch and open a PR against `main`. In the Actions tab confirm:

- Jobs: **Governance**, **CI**, **Secrets Scan**, plus **Security Audit** from `security-audit.yml`
- **CI** runs change detection first, then skips heavy steps on docs-only PRs
- Self-hosted runs consume one `Blitzcraft Trusted CI` / `ci` runner slot per workflow (not three)
- Fork PRs never use the persistent self-hosted runner

### 4. Self-hosted profile (if applicable)

1. Set `ATLAS_CI_RUNNER_PROFILE=self-hosted` on the repo.
2. Push a branch with an app change.
3. Confirm jobs land on the `Blitzcraft Trusted CI` runner group (`ci` label).
4. Second run on the same host should show faster `pnpm install` (warm store).

## Branch protection

Required status checks for `main` (verified 2026-09-12 on public `blitzcraftlabs/atlas`):

- **Governance** — licensing, provenance, and dependency-ownership gates
- **CI** — consolidated application pipeline
- **Secrets Scan** — Gitleaks scan
- **Security Audit** — Atlas dependency vulnerability policy
- **UI Quality** — Storybook axe, interaction, and visual gates

Do not remove or rename those checks. See [repository integrations](repository-integrations.md) and
[security engineering](security.md).

If branch protection still references retired job names (**Detect Changes**, **Quality**, **Build
and E2E**), update them to **CI**. Legacy names from the old **Gitleaks Secrets Scan** standalone
workflow should point to **Secrets Scan**.

## Related

- [Environment validation in CI](env.md#cicd-integration)
- [Testing](testing.md)
- [Repository integrations](repository-integrations.md)
- [Documentation link checking](documentation-policy.md#link-checking)
- [Performance tooling](../../tools/perf/README.md)
