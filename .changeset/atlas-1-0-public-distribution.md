---
"@blitzcraftlabs/atlas": major
---

Atlas 1.0 is the first supported public distribution.

The 0.x GitHub releases were the platform-development and proving line. 1.0.0 is the first supported
public npm contract for `@blitzcraftlabs/atlas`. Public CLI, generated-project, upgrade, and
distribution contracts are now treated as stable; breaking those contracts after 1.0 requires a
major version. Internal implementation may keep evolving without a major release.

1.0 includes the production-proven Atlas platform model already shipped on the 0.x proving line:
`atlas init`, deterministic bootstrap assets, clean-room consumer lifecycle, Doctor, generators,
context, upgrade/version lifecycle, UI quality gates, and security/release governance. It also
prepares fail-closed npm Trusted Publishing after GitHub Releases, including a one-time first
publish of the exact canonical `v1.0.0` tarball.

The package is not on the registry yet. Do not treat `pnpm dlx @blitzcraftlabs/atlas` as live until
`pnpm distribution:verify-registry 1.0.0` passes. Do not bootstrap npm with `0.5.0`.
