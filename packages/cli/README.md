# @blitzcraftlabs/atlas

Atlas is a forkable frontend platform template (Next.js App Router, TypeScript, Tailwind CSS, pnpm
workspaces). This package is the public **Atlas CLI**: `atlas`.

The package identity is `@blitzcraftlabs/atlas`. Internal `@atlas/*` workspaces stay private source
inside Atlas and generated projects. They are not published to npm.

## Requirements

- Node.js `>=22`
- pnpm `>=10` for the supported Atlas workflow

## Intended install (after the first npm publication)

Atlas is not on the npm registry yet. The first public version is `@blitzcraftlabs/atlas@1.0.0`.
Once that version is published from canonical Git tag `v1.0.0` and
`pnpm distribution:verify-registry 1.0.0` passes, the intended commands are:

```bash
pnpm add -g @blitzcraftlabs/atlas
atlas init my-app
```

Until then, use this repository and `pnpm atlas` / a packed tarball. Do not treat a `0.5.0` tarball
as the public npm bootstrap.

## Commands

| Command                        | Purpose                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `atlas init <project>`         | Create a source-owned Atlas project from packaged bootstrap assets |
| `atlas doctor`                 | Check Atlas contract and architecture drift                        |
| `atlas generate feature\|page` | Scaffold structural product surfaces                               |
| `atlas context [--json]`       | Resolve the executable project contract for agents                 |
| `atlas upgrade --to <version>` | Plan/apply a supported Atlas upgrade                               |

`atlas upgrade` loads production release evidence from **this installed package**, not from a
consumer `releases/` tree. The support window is the current Atlas release plus the immediately
previous supported production release, adjacent upgrades only.

`--releases-dir` is an explicit fixture/maintainer override. Missing packaged evidence fails closed.

## Upgrade support

- Production snapshots are package-owned.
- Generated consumers do not carry Atlas release history.
- Repository `releases/0.1.0` and `releases/0.2.0` are rehearsal-only and are not public support.
- After 1.0, breaking public-contract changes require a major version.

## Links

- Source: [github.com/blitzcraftlabs/atlas](https://github.com/blitzcraftlabs/atlas)
- Site: [shipwithatlas.com](https://shipwithatlas.com)
- License: Apache-2.0
