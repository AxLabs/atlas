# @blitzcraftlabs/atlas

## 1.0.0

### Major Changes

- b341368: Atlas 1.0 is the first supported public distribution.

  The 0.x GitHub releases were the platform-development and proving line. 1.0.0 is the first
  supported public npm contract for `@blitzcraftlabs/atlas`. Public CLI, generated-project, upgrade,
  and distribution contracts are now treated as stable; breaking those contracts after 1.0 requires
  a major version. Internal implementation may keep evolving without a major release.

  1.0 includes the production-proven Atlas platform model already shipped on the 0.x proving line:
  `atlas init`, deterministic bootstrap assets, clean-room consumer lifecycle, Doctor, generators,
  context, upgrade/version lifecycle, UI quality gates, and security/release governance. It also
  prepares fail-closed npm Trusted Publishing after GitHub Releases, including a one-time first
  publish of the exact canonical `v1.0.0` tarball.

  The package is not on the registry yet. Do not treat `pnpm dlx @blitzcraftlabs/atlas` as live
  until `pnpm distribution:verify-registry 1.0.0` passes. Do not bootstrap npm with `0.5.0`.

## 0.5.0

### Minor Changes

- e64f4ce: Prepare `@blitzcraftlabs/atlas` as Atlas's public npm CLI package. The `atlas` binary,
  pack allowlist, and GitHub Release workflow stay the same; this change makes the package identity
  and metadata publication-ready without publishing to the registry.

### Patch Changes

- 52baf97: Load production upgrade snapshots from the installed `@blitzcraftlabs/atlas` package
  instead of a consumer `releases/` tree, and fail closed for unsupported or missing packaged
  release evidence.
- b37e3f7: Build `@atlas/project` before generating a production release snapshot so Version PRs
  succeed after `pnpm install --frozen-lockfile` without a prior workspace build.

## 0.4.0

### Minor Changes

- ac8ef12: Add empty-directory `atlas init <project>` so an installed CLI can materialize a consumer
  project from packaged bootstrap assets.

### Patch Changes

- Make repository dependency scanning resilient to source files that disappear during concurrent
  generator validation, while continuing to fail on real filesystem and import-analysis errors.

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
