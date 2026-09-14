---
"@atlas/ui": patch
---

Declare `@types/node` on `@atlas/ui` and include Node in the UI typecheck tsconfig so generated
projects do not depend on source-monorepo hoisting or omitted Vite types.
