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

| Action                    | Purpose                                                                    |
| ------------------------- | -------------------------------------------------------------------------- |
| `setup-atlas-ci`          | Node 22 + pnpm; GitHub Actions pnpm cache or self-hosted persistent stores |
| `setup-ci-node`           | Self-hosted Node/pnpm setup for isolated per-job checkouts                 |
| `cleanup-self-hosted-job` | Clears per-job temp HOME on self-hosted runners                            |

## GitHub-hosted (default)

No configuration required. `setup-atlas-ci` uses `actions/setup-node` with `cache: pnpm`.

Optional: set [Turbo remote cache](https://turbo.build/repo/docs/core-concepts/remote-caching)
secrets (`TURBO_TOKEN`, `TURBO_TEAM`) in the repository if your team uses Vercel remote caching.

## Self-hosted runners (opt-in)

For a private runner fleet with persistent disk:

```bash
pnpm ci:self-hosted:enable
```

Set repository variable:

| Name                      | Value         |
| ------------------------- | ------------- |
| `ATLAS_CI_RUNNER_PROFILE` | `self-hosted` |

Register runners with the `ci` label. Bootstrap each host:

```bash
sudo mkdir -p /var/cache/ci
sudo chown -R <runner-user>:<runner-user> /var/cache/ci
```

**Trust boundary:** push access to the canonical Atlas repository is part of the trusted
self-hosted-runner boundary. Fork pull requests (`head.repo.full_name != github.repository`) always
run on GitHub-hosted runners, even when `ATLAS_CI_RUNNER_PROFILE=self-hosted`. Atlas does not use
`pull_request_target` to execute untrusted PR code.

Self-hosted E2E runs inside the matching `mcr.microsoft.com/playwright` Docker image so Chromium and
WebKit system libraries are available without `sudo apt-get` in CI jobs (the runner user cannot
elevate for `playwright install --with-deps`). GitHub-hosted CI installs both required browsers
explicitly. Playwright configs define the same projects locally and in CI. Web and reference suites
run sequentially in one container to reduce runner disk pressure. Installs on self-hosted runners
materialize host-only optional dependencies (`linux`/`x64` override); the Governance job on
`ubuntu-latest` still installs the full Atlas-supported architecture set for deterministic license
auditing. The container runs as the host runner user (`--user "$(id -u):$(id -g)"`) so Playwright
and Next.js artifacts written through the bind-mounted workspace are not owned by root. pnpm is
invoked via `corepack pnpm` from the repository root so Corepack honors the repo's `packageManager`
field without `corepack enable`. Playwright's dev server command uses `corepack pnpm dev` so the
webServer subprocess can resolve pnpm inside the container. Ensure Docker is installed and the
runner user can run containers.

The **CI** job uses `runs-on: [self-hosted, ci]`, a single isolated per-run checkout subdirectory
under `${{ github.workspace }}` (so a poisoned default workdir does not block `actions/checkout`),
and persistent stores:

| Variable          | Default path                            |
| ----------------- | --------------------------------------- |
| `PNPM_STORE_DIR`  | `/var/cache/ci/pnpm-store/<owner-repo>` |
| `TURBO_CACHE_DIR` | `/var/cache/ci/turbo/<owner-repo>`      |

Override the root with `CI_CACHE_ROOT` on the runner host.

To revert: delete the variable (or set `github-hosted`). See `tools/ci-self-hosted/README.md`.

## What Atlas does not ship in default CI

These are **consumer-app** concerns, not reference-platform defaults:

- Pre-seeded Postgres images or `pg_dump` artifacts
- Content-audit or DB-backed link checks

Add those in your product repo when you have a real database and content pipeline. Aviatopia's
`infra/docker/scripts/` is a reference implementation.

## Optional workflows

| Workflow              | Purpose                                                        | Enable                                   |
| --------------------- | -------------------------------------------------------------- | ---------------------------------------- |
| `security-audit.yml`  | Blocking Atlas vulnerability policy + workflow pin checks      | On by default (PRs, `main`, weekly)      |
| `perf-lighthouse.yml` | Lighthouse CI budgets                                          | `pnpm perf:enable`                       |
| `perf-bundle.yml`     | Bundle size analysis                                           | `pnpm perf:enable`                       |
| `release.yml`         | Atlas Version PR only (GitHub Release publication not enabled) | On `main`; `workflow_dispatch` rehearsal |

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
- Self-hosted runs consume one `[self-hosted, ci]` runner slot per workflow (not three)
- Fork PRs never use the persistent self-hosted runner

### 4. Self-hosted profile (if applicable)

1. Set `ATLAS_CI_RUNNER_PROFILE=self-hosted` on the repo.
2. Push a branch with an app change.
3. Confirm jobs land on `[self-hosted, ci]` runners.
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
