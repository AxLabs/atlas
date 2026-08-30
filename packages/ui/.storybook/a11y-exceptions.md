# Accessibility exceptions

Automated axe checks run against critical-tagged representative Storybook stories in CI via
`@storybook/test-runner` and `axe-playwright`. Exceptions must stay narrow and documented here.

| Story ID | Rule disabled | Reason | Owner | Follow-up |
| -------- | ------------- | ------ | ----- | --------- |

Global axe rule weakening is not allowed. Use story-level `parameters.a11y.config` only when the
violation is a documented false positive or intentionally unsupported demo pattern.

## Quarantine policy

Flaky or temporarily broken stories must not be permanently `skip()`'d. Any quarantine requires a
linked issue, owner, reason, and expiry date recorded in this file.
