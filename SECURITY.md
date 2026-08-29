# Security Policy

Atlas is a forkable frontend platform template. This document describes how maintainers handle
security reports for the Atlas repository. It is **not** a contractual SLA, a certification, or a
claim that Atlas is free of vulnerabilities.

## Supported versions

Atlas supports the **current release line on `main` after the latest intentional version merge**.
Security and compatibility fixes are prioritized for that line.

| Line                        | Security fixes              |
| --------------------------- | --------------------------- |
| Current Atlas `0.x` on main | Yes — prioritized           |
| Older pre-1.0 snapshots     | Only when explicitly stated |
| LTS                         | None at this stage          |

See [Releases and governance](docs/how-we-build/releases-and-governance.md) for versioning and
support policy. Do not assume older tagged snapshots receive patches.

## Reporting a vulnerability

**Do not disclose suspected vulnerabilities through a public GitHub issue.**

Prefer GitHub's private vulnerability reporting on this repository (Security advisories / private
vulnerability reporting) when the GitHub plan and repository settings allow it.

If private reporting is unavailable on the current GitHub plan, contact a repository maintainer
through the existing private collaboration channel for this engagement. Do not invent or publish a
new security-contact email address.

Include:

- a description of the issue and affected Atlas surfaces;
- steps to reproduce, or a proof of concept that does **not** include real credentials;
- Atlas version, commit SHA, or downstream fork baseline if known;
- any mitigating configuration you already applied.

## Internal response targets

These are **internal maintainer targets**, not contractual SLAs.

| Severity | Acknowledge / triage                        | Remediation target (when practical) |
| -------- | ------------------------------------------- | ----------------------------------- |
| Critical | Urgently, typically within 24–48 hours      | ≤ 24–48 hours                       |
| High     | ≤ 2 business days                           | ≤ 7 days                            |
| Moderate | ≤ 5 business days                           | ≤ 30 days                           |
| Low      | Planned according to risk and release cycle | Next suitable release               |

Severity for dependency findings follows the Atlas vulnerability policy
([`security/policy.json`](security/policy.json)): **HIGH and CRITICAL block CI** unless a
machine-readable, time-limited exception is in force.

## Downstream propagation

Atlas security fixes land on `main`, then ship to downstream Atlas consumers through the existing
upgrade and fix-propagation machinery — not as an independent npm security product.

See:

- [Upgrades and downstream fix propagation](docs/how-we-build/upgrades.md)
- [ADR-0010](docs/adr/0010-atlas-upgrades-downstream-propagation.md)

Typical path:

```text
security fix → Atlas main → versioned Atlas snapshot / migration notes → consumer upgrade
```

Auth session code and `lib/security/**` are high-scrutiny synced surfaces. Customized consumer
copies are merge-required during upgrades.

## Related documents

- [Atlas threat model](docs/security/threat-model.md)
- [Security engineering](docs/how-we-build/security.md)
- [Continuous integration](docs/how-we-build/ci.md)
