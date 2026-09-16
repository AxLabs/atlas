---
"@blitzcraftlabs/atlas": patch
---

Build `@atlas/project` before generating a production release snapshot so Version PRs succeed after
`pnpm install --frozen-lockfile` without a prior workspace build.
