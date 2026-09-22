---
"@blitzcraftlabs/atlas": minor
---

Add `atlas enable` for opt-in consumer tooling, and fix first-commit hooks plus Playwright
alignment.

Published npm 1.1.0 does not include `enable`. This changeset is how that command (and the
consumer-tooling follow-ups) enter the next CLI release. Generated enable invocations keep
`<next-cli-release>` until this Version PR assigns a version that is not in
`CLI_RELEASES_WITHOUT_ENABLE`; they pin that assigned CLI for `enable` even when a consumer baseline
is still 1.1.0. Doctor/generate stay on the consumer baseline. Do not treat `enable` as live on npm
until that release is published.
