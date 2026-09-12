# Changelog

All notable changes to **Atlas** (the repository/platform snapshot) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and Atlas follows
[Semantic Versioning](https://semver.org/) for repository releases. See
[Releases and Governance](docs/how-we-build/releases-and-governance.md) for the full policy.

## [Unreleased]

## [0.2.0] - 2026-09-12

### Added

- Repository-level release governance: Apache-2.0 license, versioning policy, support expectations,
  breaking-change process, Version PR workflow, and fail-closed GitHub Release publication.
- Public documentation aligned to the Apache-2.0 GitHub repository: clone/fork access, contribution
  model, and durable evidence in place of private-era issue numbers.

### Changed

- Improve search input styling, badge alignment, and server-safe theme boot constants.

### Fixed

- Repair release automation so Version PRs validate at the new Atlas line and fail-closed GitHub
  Release publication can create the first canonical public `vX.Y.Z` tag after the Version PR
  merges.

### Security

- Make Atlas security checks blocking: HIGH/CRITICAL dependency policy, pinned Actions and Gitleaks,
  SPDX snapshots, and a published threat model.

## 0.1.0 - 2026-08-19

> Historical internal Atlas snapshot. No canonical public Git tag or GitHub Release was published
> for this version.

### Added

- Initial pre-1.0 platform snapshot baseline.
- Enterprise frontend platform monorepo: `@atlas/web` template app, `@atlas/ui`, `@atlas/config`,
  `@atlas/consent`, conventions, and documentation.

[Unreleased]: https://github.com/blitzcraftlabs/atlas/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/blitzcraftlabs/atlas/releases/tag/v0.2.0
