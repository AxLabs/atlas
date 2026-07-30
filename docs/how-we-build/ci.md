# Continuous Integration

Atlas ships a single portable CI workflow (`.github/workflows/ci.yml`) that runs on **GitHub-hosted
runners by default**. Teams with a self-hosted fleet can opt in without replacing workflow files.

## Pipeline layout

```text
pull_request / push to main
  ├── Detect Changes     (path filter; no install)
  ├── Secrets Scan       (Gitleaks; parallel)
  ├── Quality            (one pnpm install when app code changed)
  └── Build and E2E      (one pnpm install; parallel with Quality)
```

| Job                | When it runs                                                        | What it does                                                    |
| ------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Detect Changes** | Always                                                              | Sets `app=true` when PR touches app/packages/tooling paths      |
| **Secrets Scan**   | Always                                                              | Gitleaks Docker scan                                            |
| **Quality**        | Always (shell checks); full suite when `app=true` or push to `main` | Lockfile policy, `validate:env`, format, lint, typecheck, tests |
| **Build and E2E**  | `app=true` or push to `main`                                        | Production build + Playwright                                   |

**Docs-only PRs** skip install, lint, typecheck, tests, build, and E2E after the lightweight policy
checks.

**Push to `main`** always runs the full suite.

## Local parity

Run the same checks before opening a PR:

```bash
pnpm install --frozen-lockfile
pnpm validate:env
pnpm format && pnpm lint && pnpm typecheck && pnpm test
pnpm build
pnpm --filter @atlas/web test:e2e
```

Minimum bar (matches `CONTRIBUTING.md`):

```bash
pnpm lint && pnpm typecheck && pnpm test
```

## Composite actions

| Action                    | Purpose                                                                    |
| ------------------------- | -------------------------------------------------------------------------- |
| `setup-atlas-ci`          | Node 22 + pnpm; GitHub Actions pnpm cache or self-hosted persistent stores |
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

Jobs then use `runs-on: [self-hosted, ci]` and persistent stores:

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
- Isolated per-run checkout directories (only needed on long-lived self-hosted workdirs)

Add those in your product repo when you have a real database and content pipeline. Aviatopia's
`infra/docker/scripts/` is a reference implementation.

## Optional workflows

| Workflow              | Purpose               | Enable                   |
| --------------------- | --------------------- | ------------------------ |
| `security-audit.yml`  | Weekly `pnpm audit`   | On by default (schedule) |
| `perf-lighthouse.yml` | Lighthouse CI budgets | `pnpm perf:enable`       |
| `perf-bundle.yml`     | Bundle size analysis  | `pnpm perf:enable`       |
| `release.yml`         | Changesets versioning | On by default on `main`  |

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
# Open PR → Quality runs policy checks only; Build and E2E skipped
```

```bash
# App change should run full suite
git checkout -b test/ci-app-change
# touch apps/web/src/app/page.tsx, commit, push, open PR
```

### 3. On GitHub Actions

Push a branch and open a PR against `main`. In the Actions tab confirm:

- Four jobs (or three if docs-only: no Build and E2E)
- **Quality** and **Build and E2E** run in parallel after **Detect Changes**
- **Secrets Scan** runs in parallel
- Wall time is lower than the old seven-job pipeline (check run history)

### 4. Self-hosted profile (if applicable)

1. Set `ATLAS_CI_RUNNER_PROFILE=self-hosted` on the repo.
2. Push a branch with an app change.
3. Confirm jobs land on `[self-hosted, ci]` runners.
4. Second run on the same host should show faster `pnpm install` (warm store).

## Branch protection

If branch protection referenced the old **Gitleaks Secrets Scan** workflow, update required checks
to **CI / Secrets Scan** (job inside the `CI` workflow).

## Related

- [Environment validation in CI](env.md#cicd-integration)
- [Testing](testing.md)
- [Performance budgets (opt-in)](../_archive/2025-12-pre-platform-docs/performance-budgets.md)
