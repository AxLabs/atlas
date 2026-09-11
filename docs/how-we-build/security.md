# Atlas security engineering

Canonical engineering notes for Atlas security gates, pins, and repository settings. Runtime abuse
cases belong in the [threat model](../security/threat-model.md). Reporting process lives in root
[`SECURITY.md`](../../SECURITY.md).

## Vulnerability policy

Atlas does **not** treat `pnpm audit`'s exit code as the security policy.

```text
pnpm audit --json
        ↓
raw advisory data
        ↓
scripts/security-audit.mjs
        ↓
security/policy.json + security-audit-exceptions.json
        ↓
human-readable summary
        ↓
exit 0 / exit 1
```

Checked-in policy ([`security/policy.json`](../../security/policy.json)):

- **Blocking threshold:** `high` (HIGH and CRITICAL)
- Remaining HIGH lockfile findings after in-range upgrades and `pnpm.overrides` are listed in
  [`security-audit-exceptions.json`](../../security-audit-exceptions.json) with owners,
  path-specific rationale, compensating controls, and an expiry of 2026-11-27. Removing or letting
  those expire re-blocks CI.
- Moderate and low findings are **reported** and do not block unless the policy file is changed
- `pnpm audit` is invoked **without** `--audit-level` filtering so the evaluator sees the full
  report
- Registry/JSON/schema failures **fail closed**
- Vulnerability-related `pnpm audit` exit `1` is expected input, not a green-CI bypass

Commands:

```bash
pnpm security:check
pnpm security:workflow-check
```

### Exceptions

[`security-audit-exceptions.json`](../../security-audit-exceptions.json) is fail-closed:

- required `owner`, `reason`, `compensatingControl`, `reviewedOn`, `expiresOn`
- precise `advisory` (`GHSA-…` or `CVE-…`) and `packageName`
- expired, malformed, wildcard, or mismatched entries fail
- stale exceptions (no matching current finding) fail

## Secret scanning

The **Secrets Scan** job in `.github/workflows/ci.yml` checks out with `fetch-depth: 0` and runs the
digest-pinned Gitleaks image (`gitleaks` v8.30.1 in `security/policy.json`) in git-aware mode:

```text
gitleaks git --redact --verbose --exit-code 1 /repo
```

Coverage is the Git history present in that checkout (commits reachable from the fetched refs GitHub
Actions materializes for the job). It is **not** a guarantee that every remote branch name that ever
existed on every fork is scanned if it was never fetched. Docker uses `--network=none`.

A synthetic GitHub-token-shaped fixture is assembled **at runtime**
(`scripts/gitleaks-fixture.mjs`): a temporary repository commits the token, deletes it, and asserts
the working tree is clean while Gitleaks still exits non-zero because the secret remains in history.
The token is never committed to Atlas.

## GitHub Actions pins

Remote `uses:` references must match `owner/repo[@/subpath]@<exactly 40 hex characters>`.
`pnpm security:workflow-check` is an allow-rule: tags, branches, and truncated SHAs fail, including
refs that are not in a known-mutable list (`@stable`, `@release`, `@abcdef1`, …).

Local `uses: ./…` actions are bound to the checked-out commit.

## Dependency review

GitHub-native Dependency Review / Dependency Graph SBOM export is **not currently treated as Atlas
evidence**. Atlas enforces an equivalent PR-time gate:

- `.github/workflows/security-audit.yml` runs on every pull request
- `pnpm security:check` evaluates the full `pnpm audit` document against Atlas policy

License classification remains `pnpm licenses:check` ([provenance.md](provenance.md)). This workflow
does not duplicate license policy.

## SBOM

Atlas generates an SPDX 2.3 JSON snapshot from `pnpm-lock.yaml` on `main` pushes,
version-tag-equivalent snapshots, and `workflow_dispatch` via the Release workflow. Artifacts are
named `atlas-sbom-<sha>` and retained for 90 days. This is **not** a GitHub Dependency Graph export.

```bash
pnpm sbom:generate
```

## Self-hosted runners

Push access to the canonical Atlas repository is part of the trusted self-hosted-runner boundary.
External fork pull requests **must not** run on persistent Atlas self-hosted machines.

`ci.yml` selects `[self-hosted, ci]` only when `ATLAS_CI_RUNNER_PROFILE=self-hosted` **and**:

```text
github.event_name != 'pull_request'
  || github.event.pull_request.head.repo.full_name == github.repository
```

Fork PRs always use GitHub-hosted `ubuntu-latest`. Atlas does not use `pull_request_target` to check
out untrusted code.

`pnpm security:workflow-check` fails if a workflow routes self-hosted jobs without that trust check,
or if `pull_request_target` is introduced.

## Branch protection / rulesets (expected)

Inspected 2026-08-29 via GitHub API for `blitzcraftlabs/atlas` while the repository was still
private. The canonical repository is now **public**. Reproduce required checks on the public repo:

| Setting                           | Historical private-plan result             |
| --------------------------------- | ------------------------------------------ |
| Visibility                        | Private at inspection time; **public now** |
| Branch protection API             | HTTP 403 on the then-private plan          |
| Repository rulesets API           | HTTP 403 on the then-private plan          |
| Dependency Graph SBOM             | HTTP 404                                   |
| Advanced Security / code scanning | HTTP 403                                   |
| `security_and_analysis`           | `null` (not returned for that token/plan)  |

**That inspection did not modify branch protection.** On the public repository, require at least:

- **CI / Governance**
- **CI / CI**
- **CI / Secrets Scan**
- **Security Audit / Security Audit**

Do not treat GitHub Dependency Graph, Advanced Security, or a formal penetration test as currently
proven Atlas evidence.

## Security-fix propagation

Documented in [`SECURITY.md`](../../SECURITY.md) and [upgrades.md](upgrades.md). Workspace packages
are not published to npm. Canonical GitHub Release publication is not enabled yet.

## Current limitations

| Topic                         | Current state                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------- |
| Risk-based testing            | Enforced via `pnpm test:risk-coverage` and [testing.md](testing.md)           |
| Independent review / runbooks | Atlas does not currently publish production SLO or incident-response evidence |
| Formal certification          | Out of scope — no WCAG, SOC, or pentest certification is claimed              |
| GitHub Release publication    | Not enabled by current automation                                             |
