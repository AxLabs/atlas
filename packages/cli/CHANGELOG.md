# @atlas/cli

## 0.3.0

### Minor Changes

- ea0e911: Package a versioned Atlas bootstrap asset tree inside the CLI so an installed tarball can
  locate the supported starter baseline without the monorepo.
- 282048e: Make the Atlas CLI independently packable by internalizing the project-contract runtime
  so a tarball can install and run outside the monorepo without unpublished workspace dependencies.

## 0.2.1

### Patch Changes

- c5b6e82: Fix release publication after an existing canonical release so post-release `main`
  commits no-op when the published tag is a proven ancestor instead of attempting to retag it.
  - @atlas/project@0.2.1

## 0.2.0

### Minor Changes

- 95b0be9: Repair release automation so Version PRs validate at the new Atlas line and fail-closed
  GitHub Release publication can create the first canonical public `vX.Y.Z` tag after the Version PR
  merges.
- 96cc938: Make Atlas security checks blocking: HIGH/CRITICAL dependency policy, pinned Actions and
  Gitleaks, SPDX snapshots, and a published threat model.

### Patch Changes

- @atlas/project@0.2.0
