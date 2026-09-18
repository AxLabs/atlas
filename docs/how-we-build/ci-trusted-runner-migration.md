# Trusted self-hosted runner migration

Atlas ships trusted self-hosted execution in two phases so callers can pin a main-branch reusable
workflow only after that workflow exists on `main`.

## Phase 1 (land first)

Merge to `main`:

- `.github/workflows/trusted-self-hosted.yml` (valid `workflow_call` entry point)
- Shared composite actions under `.github/actions/run-*-suite/`
- Documentation and CI policy validation

Caller workflows (`ci.yml`, `ui-quality.yml`, `perf-bundle.yml`) continue to use the existing
GitHub-hosted path and the legacy `[self-hosted, ci]` label routing in `ci.yml` until Phase 2.

Do **not** enable the organization runner-group workflow allowlist yet.

## Phase 2 (after Phase 1 is on main)

Open a Phase-2 migration PR (suggested branch: `ci/trusted-self-hosted-runner-phase2`) **only after
Phase 1 is on `main`**. That PR must:

1. Remove direct `[self-hosted, ci]` targeting from caller workflows.
2. Pin callers to: `blitzcraftlabs/atlas/.github/workflows/trusted-self-hosted.yml@refs/heads/main`
   with only `with.suite` — no `runner_group`, `check_name`, `timeout-minutes`, or
   `secrets: inherit` on reusable-workflow caller jobs.
3. Add hosted executors (`CI (hosted)`, `UI Quality (hosted)`, `Bundle Analysis (hosted)`) and final
   aggregators (`CI`, `UI Quality`, `Bundle Analysis`) for branch protection.
4. Use `vars`/`github` expressions in job-level `if:` (the `env` context is unavailable on
   reusable-workflow caller jobs).
5. Pass only explicit secrets where required (`CODECOV_TOKEN` for the `ci` trusted caller).

Phase-2 policy validation activates automatically once callers reference `trusted-self-hosted.yml`.

Then configure GitHub manually:

| Setting                   | Value                                                                            |
| ------------------------- | -------------------------------------------------------------------------------- |
| Runner group              | `Blitzcraft OSS Trusted`                                                         |
| Runner label              | `ci`                                                                             |
| Workflow allowlist        | `blitzcraftlabs/atlas/.github/workflows/trusted-self-hosted.yml@refs/heads/main` |
| `ATLAS_CI_RUNNER_PROFILE` | `self-hosted`                                                                    |
| `ATLAS_CI_RUNNER_GROUP`   | `Blitzcraft OSS Trusted` (optional; trusted workflow defaults to this)           |

## Security model (Phase 2)

- Only the main-pinned trusted reusable workflow may target the runner group.
- Fork PRs never call the trusted path (`ATLAS_CI_USE_SELF_HOSTED` is false).
- The trusted workflow repeats the fork gate before scheduling self-hosted jobs.
- Offline Turing hosts fail closed; there is no silent fallback to GitHub-hosted when
  `ATLAS_CI_RUNNER_PROFILE=self-hosted`.
