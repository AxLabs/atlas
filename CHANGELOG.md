# Changelog

All notable changes to **Atlas** (the repository/platform snapshot) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and Atlas follows
[Semantic Versioning](https://semver.org/) for repository releases. See
[Releases and Governance](docs/how-we-build/releases-and-governance.md) for the full policy.

## [Unreleased]

## [0.5.0] - 2026-09-17

### Changed

- Prepare `@blitzcraftlabs/atlas` as Atlas's public npm CLI package. The `atlas` binary, pack
  allowlist, and GitHub Release workflow stay the same; this change makes the package identity and
  metadata publication-ready without publishing to the registry.
- Load production upgrade snapshots from the installed `@blitzcraftlabs/atlas` package instead of a
  consumer `releases/` tree, and fail closed for unsupported or missing packaged release evidence.
- Build `@atlas/project` before generating a production release snapshot so Version PRs succeed
  after `pnpm install --frozen-lockfile` without a prior workspace build.

## [0.4.0] - 2026-09-15

### Changed

- Declare `@types/node` on `@atlas/ui` and include Node in the UI typecheck tsconfig so generated
  projects do not depend on source-monorepo hoisting or omitted Vite types.
- Add empty-directory `atlas init <project>` so an installed CLI can materialize a consumer project
  from packaged bootstrap assets.

### Fixed

- Make repository dependency scanning resilient to source files that disappear during concurrent
  generator validation, while continuing to fail on real filesystem and import-analysis errors.

## [0.3.0] - 2026-09-14

### Changed

- Package a versioned Atlas bootstrap asset tree inside the CLI so an installed tarball can locate
  the supported starter baseline without the monorepo.
- Make the Atlas CLI independently packable by internalizing the project-contract runtime so a
  tarball can install and run outside the monorepo without unpublished workspace dependencies.

## [0.2.1] - 2026-09-12

### Fixed

- Fix release publication after an existing canonical release so post-release `main` commits no-op
  when the published tag is a proven ancestor instead of attempting to retag it.

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

[Unreleased]: https://github.com/blitzcraftlabs/atlas/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/blitzcraftlabs/atlas/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/blitzcraftlabs/atlas/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/blitzcraftlabs/atlas/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/blitzcraftlabs/atlas/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/blitzcraftlabs/atlas/releases/tag/v0.2.0
