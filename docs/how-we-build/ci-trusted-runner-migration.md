# Trusted self-hosted runner migration

Atlas ships trusted self-hosted execution in two phases so callers can pin a main-branch reusable
workflow only after that workflow exists on `main`.

## Canonical Turing infrastructure (immutable)

This is repository-workflow routing only. Atlas must not register, unregister, rename, relabel, or
move GitHub runners. The live fleet remains:

```text
Default
├── ada-1
│   labels: self-hosted, Linux, X64, ada, ci
└── ada-2
    labels: self-hosted, Linux, X64, ada, ci

Blitzcraft Trusted CI
├── turing-ci-1
│   /opt/actions-runner-1
│   labels: self-hosted, Linux, X64, ci, turing
└── turing-ci-2
    /opt/actions-runner-2
    labels: self-hosted, Linux, X64, ci, turing
```

| Setting           | Value                                                                            |
| ----------------- | -------------------------------------------------------------------------------- |
| Runner group      | `Blitzcraft Trusted CI`                                                          |
| Runners           | `turing-ci-1`, `turing-ci-2`                                                     |
| Labels            | `ci,turing`                                                                      |
| Capacity          | `RUNNER_COUNT=2` (slots 3 and 4 inactive)                                        |
| Persistent caches | `/var/cache/ci`                                                                  |
| Atlas allowlist   | `blitzcraftlabs/atlas/.github/workflows/trusted-self-hosted.yml@refs/heads/main` |
| Caller `uses:`    | `blitzcraftlabs/atlas/.github/workflows/trusted-self-hosted.yml@main`            |

The group is **shared** with selected trusted private BlitzCraft workflows (for example Aviatopia
and publishing-platform CI). Atlas is not the only consumer. Atlas can reach Turing **only** through
the main-pinned reusable workflow. Callers must never use `runs-on: [self-hosted, ci]`,
`runs-on.group`, or runner identities (`turing-ci-1` / `turing-ci-2`).

These two GitHub formats are not interchangeable:

```text
Reusable workflow caller:
blitzcraftlabs/atlas/.github/workflows/trusted-self-hosted.yml@main

Runner-group workflow allowlist:
blitzcraftlabs/atlas/.github/workflows/trusted-self-hosted.yml@refs/heads/main
```

Do not change the organization runner-group allowlist to match the caller `uses:` string.

`ATLAS_CI_RUNNER_GROUP` stays optional/unset. The trusted workflow defaults to
`Blitzcraft Trusted CI`.

## Phase 1 (landed)

Merged to `main`:

- `.github/workflows/trusted-self-hosted.yml` (valid `workflow_call` entry point)
- Shared composite actions under `.github/actions/run-*-suite/`
- Documentation and CI policy validation

## Phase 2 (this migration)

Caller workflows (`ci.yml`, `ui-quality.yml`) keep hosted/trusted/aggregator layers. Bundle Analysis
(`perf-bundle.yml`) stays on GitHub-hosted Ubuntu so the two Turing runners are available for **CI**
and **UI Quality**.

| Workflow          | Hosted executor           | Trusted caller              | Aggregator (required check)    |
| ----------------- | ------------------------- | --------------------------- | ------------------------------ |
| `ci.yml`          | `ci-hosted` / CI (hosted) | `ci-trusted` / CI (trusted) | `ci` / **CI**                  |
| `ui-quality.yml`  | `ui-quality-hosted`       | `ui-quality-trusted`        | `ui-quality` / **UI Quality**  |
| `perf-bundle.yml` | `bundle-hosted`           | none (never Turing)         | `bundle` / **Bundle Analysis** |

Trusted callers pin exactly:

```text
blitzcraftlabs/atlas/.github/workflows/trusted-self-hosted.yml@main
```

They pass only `with.suite`. They do not set `runs-on`, `runner_group`, `check_name`,
`timeout-minutes`, or `secrets: inherit`. Caller jobs must grant `pull-requests: write` because the
reusable workflow requests it (otherwise GitHub rejects the whole workflow at startup). The `ci`
caller passes only `CODECOV_TOKEN`. Job-level `if:` uses `vars` and `github` directly.

Leave `ATLAS_CI_RUNNER_PROFILE=github-hosted` until Phase 2 is merged. Switching the variable on the
Phase 2 PR would deadlock because `main` still has the old callers.

## Hosted / trusted routing

| Event        | Profile         | Source   | Hosted | Trusted |
| ------------ | --------------- | -------- | -----: | ------: |
| same-repo PR | `github-hosted` | Atlas    |    run |    skip |
| same-repo PR | `self-hosted`   | Atlas    |   skip |     run |
| fork PR      | `github-hosted` | external |    run |    skip |
| fork PR      | `self-hosted`   | external |    run |    skip |
| push to main | `github-hosted` | Atlas    |    run |    skip |
| push to main | `self-hosted`   | Atlas    |   skip |     run |

The table above applies to **CI** and **UI Quality**. UI Quality also skips both executors when
hosted path detection reports no UI-impacting files (aggregator succeeds). **Bundle Analysis**
always uses GitHub-hosted Ubuntu when it runs; it never occupies Turing and is not a hosted fallback
for a trusted failure.

A fork PR never reaches Turing, regardless of `ATLAS_CI_RUNNER_PROFILE`.

There is **no** GitHub-hosted fallback when `profile=self-hosted`, the work is same-repo trusted
**CI or UI Quality** execution, and Turing is offline. That condition queues or fails closed.

## Aggregators

Branch protection keeps depending on **CI**, **UI Quality**, and **Bundle Analysis**. Each
aggregator uses `if: always()`, runs on GitHub-hosted Ubuntu, and:

- **CI / UI Quality:** succeed for `success` + `skipped` (either direction); fail if the selected
  path failed or was cancelled; fail if both executors skipped unless UI path detection reported no
  UI-impacting changes
- **Bundle Analysis:** succeed when path detection skips the suite, or when the GitHub-hosted
  analyzer succeeds; fail closed if the hosted analyzer failed
- do not turn a trusted CI/UI Quality failure green

## Workloads that stay GitHub-hosted

Governance, Secrets Scan, Security Audit, Release, Lighthouse, Bundle Analysis, and visual-baseline
updates stay on GitHub-hosted runners. No release/publish/deploy/signing work moves to Turing.

## Workspace layout

GitHub-hosted and Turing CI suites must see the same repository filesystem layout. Trusted checkout
uses ordinary `actions/checkout` into `${{ github.workspace }}` (`package.json`, `apps/`,
`packages/`, `scripts/`, `.github/`). Local composite actions are invoked as
`./.github/actions/...`. Persistent pnpm/Turbo caches stay under `/var/cache/ci`; Playwright still
runs in Docker on Turing.

## After merge (not part of Phase 2)

Set `ATLAS_CI_RUNNER_PROFILE=self-hosted` only after this migration is on `main`. Do not mutate the
runner fleet to activate Atlas.
