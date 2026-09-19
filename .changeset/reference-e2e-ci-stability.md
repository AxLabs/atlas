---
"@atlas/web": patch
"@atlas/reference": patch
---

Stabilize reference harness control mutations, keep reset preview cache consistent with server
state, retain Playwright traces on CI failure, and drop unused Next.js `optimizeCss` from starter
config so consumer and maintainer CI no longer depend on missing Critters.
