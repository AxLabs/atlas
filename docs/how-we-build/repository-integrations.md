# Repository integrations and GitHub settings

Maintainer-facing record of how the canonical public repository
[`blitzcraftlabs/atlas`](https://github.com/blitzcraftlabs/atlas) is connected to GitHub features
and third-party apps. Public contributors do not need this page to open issues or pull requests;
start from [CONTRIBUTING.md](../../CONTRIBUTING.md).

Inspected **2026-09-12** against repository ID `1366318006`. Do not assume pre-cutover settings from
a previous GitHub repository identity still apply.

## Canonical remotes

Active Atlas development uses the public repository as `origin`:

```text
origin    git@github.com:blitzcraftlabs/atlas.git
```

A private archive remote may exist on maintainer clones for historical issues. It is **not** the
development, PR, or release origin.

Automation in this repository uses `github.repository` / `GITHUB_REPOSITORY` and defaults to
`blitzcraftlabs/atlas`. Release compare and tag URLs are hardcoded to the public repository.

## Integration matrix

| Integration / capability              | State                        | Scope                    | Verification                                                                                        |
| ------------------------------------- | ---------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------- |
| GitHub Actions                        | active                       | public repo              | Workflows green on `main` at `cbd5828` (`v0.2.0` published)                                         |
| Required checks                       | enabled                      | `main` branch protection | Governance, CI, Secrets Scan, Security Audit, UI Quality                                            |
| Private vulnerability reporting       | enabled                      | public repo              | `GET /repos/.../private-vulnerability-reporting` → `{"enabled":true}`                               |
| Secret scanning                       | enabled                      | public repo              | `security_and_analysis.secret_scanning`                                                             |
| Secret scanning push protection       | enabled                      | public repo              | `security_and_analysis.secret_scanning_push_protection`                                             |
| Secret scanning validity checks       | intentionally disabled       | public repo              | Optional provider-liveness check; Gitleaks + scanning + push protection already cover known secrets |
| Secret scanning non-provider patterns | intentionally disabled       | public repo              | Likely noise on a template with example credentials; Gitleaks remains the CI gate                   |
| Dependabot vulnerability alerts       | enabled                      | public repo              | `GET /repos/.../vulnerability-alerts` → HTTP 204                                                    |
| Dependabot security updates           | enabled                      | public repo              | Native GitHub security-update workflow; no `dependabot.yml` version-update file                     |
| GitHub code scanning                  | not applicable               | public repo              | No CodeQL workflow; Atlas uses Gitleaks + `pnpm security:check`                                     |
| Codecov                               | upload failing               | public repo              | CI step runs and is non-blocking; latest `main` upload rejected (`Token required`)                  |
| Vercel GitHub App                     | intentionally not connected  | public Atlas repo        | No Vercel project linked to `blitzcraftlabs/atlas`; showcase lives in `atlas-showcase`              |
| ChatGPT / Codex GitHub App            | manual verification required | selected-repo org app    | Org installation exists; user token cannot list selected repositories                               |
| Cursor GitHub App                     | organization-wide            | all org repos            | `repository_selection: all`; no repo-specific action                                                |

## Codecov

CI uploads coverage with `codecov/codecov-action` and `fail_ci_if_error: false`. That policy is
intentional: local `pnpm test:risk-coverage` is the blocking gate. See [testing.md](testing.md).

On `main` run `34692166839` (`cbd5828`, 2026-09-12):

- `GITHUB_REPOSITORY` was `blitzcraftlabs/atlas`
- Token length was `0` (no `CODECOV_TOKEN`, OIDC unused, Codecov GitHub App not installed on the
  org)
- Upload failed: `Token required - not valid tokenless upload`
- The CI job stayed green because the step is non-blocking

**Maintainer action:** in the Codecov GitHub App (or Codecov UI), add the **new** public repository
`blitzcraftlabs/atlas` (ID `1366318006`). Do not reuse the old private archive identity. Prefer the
GitHub App over adding `CODECOV_TOKEN` unless the app cannot be installed.

After that, confirm https://app.codecov.io/gh/blitzcraftlabs/atlas shows coverage for a subsequent
`main` or PR upload. Do not treat a green CI log as proof until that Codecov project page exists.

## Vercel

The BlitzCraft Vercel team has Git-linked projects for other repositories, including
`atlas-showcase`. None of the listed projects link to `blitzcraftlabs/atlas`. Atlas itself is a
forkable template; the public marketing site is [shipwithatlas.com](https://shipwithatlas.com).

Connecting Vercel to the public Atlas repository is **not required** for template CI or GitHub
Releases. Do not grant the Vercel GitHub App extra repositories unless a maintainer later wants
preview deploys of this repo.

## ChatGPT / Codex

The `chatgpt-codex-connector` GitHub App is installed on the `blitzcraftlabs` organization with
**selected-repository** access. Listing those repositories requires a GitHub App installation token,
which this audit did not have.

**Maintainer action (only if Codex should see public Atlas):** open
[GitHub App installations](https://github.com/organizations/blitzcraftlabs/settings/installations) →
ChatGPT Codex connector → confirm `blitzcraftlabs/atlas` (ID `1366318006`) is selected. Do not
broaden the app to every organization repository unless that is already intended.

## GitHub-native security settings

| Setting                         | Disposition            | Rationale                                                                                                             |
| ------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Vulnerability alerts            | enabled                | Needed for Dependabot security updates                                                                                |
| Dependabot security updates     | enabled                | GitHub-native patches; Atlas still blocks HIGH/CRITICAL via `pnpm security:check`                                     |
| Private vulnerability reporting | enabled                | Public issue forms redirect here; see [SECURITY.md](../../SECURITY.md)                                                |
| Secret scanning                 | enabled                | Complements CI Gitleaks                                                                                               |
| Push protection                 | enabled                | Blocks known-provider secrets on push                                                                                 |
| Validity checks                 | intentionally disabled | Optional after a secret is found; enable in GitHub UI later if maintainers want liveness checks                       |
| Non-provider patterns           | intentionally disabled | High false-positive risk on example env/template files                                                                |
| Code scanning / CodeQL          | not applicable         | Not claimed as Atlas evidence; do not enable casually                                                                 |
| Branch protection on `main`     | enabled                | Classic protection (no rulesets). Required checks must stay: Governance, CI, Secrets Scan, Security Audit, UI Quality |
| Required reviews                | not applicable         | Unset; single maintainer. Do not add a review requirement that blocks the only admin                                  |
| Enforce admins                  | intentionally disabled | Current setting; do not weaken required checks. Enabling later is a maintainer choice                                 |
| Required signatures             | intentionally disabled | Not part of the Atlas contributor contract                                                                            |

Do **not** remove or rename the required checks listed above.

## Repository metadata

Expected public state (verified 2026-09-12):

- Public template repository, default branch `main`
- Homepage `https://shipwithatlas.com`
- Issues enabled; Discussions, Wiki, and Projects disabled
- Forking enabled; delete branch on merge enabled
- Topics: `nextjs`, `react`, `typescript`, `tailwindcss`, `monorepo`, `pnpm`, `design-system`,
  `accessibility`, `frontend`, `shadcn-ui`

## Community files

| File                                     | Role                                           |
| ---------------------------------------- | ---------------------------------------------- |
| `.github/ISSUE_TEMPLATE/config.yml`      | Issue chooser; blank issues off; security link |
| `.github/ISSUE_TEMPLATE/bug.yml`         | Public bug form                                |
| `.github/ISSUE_TEMPLATE/feature.yml`     | Public feature / improvement form              |
| `.github/ISSUE_TEMPLATE/docs.yml`        | Public documentation form                      |
| `.github/pull_request_template.md`       | Short PR contributor checklist                 |
| [SECURITY.md](../../SECURITY.md)         | Vulnerability reporting                        |
| [CONTRIBUTING.md](../../CONTRIBUTING.md) | Contributor workflow                           |

## Related

- [Continuous integration](ci.md)
- [Security engineering](security.md)
- [Releases and governance](releases-and-governance.md)
