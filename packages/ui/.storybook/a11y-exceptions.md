# Accessibility exceptions

Automated axe checks run against critical-tagged representative Storybook stories in CI via
`@storybook/test-runner` and `axe-playwright`. Exceptions must stay narrow and documented in the
machine-readable registry `a11y-exceptions.json` (same directory).

| Story ID | Rule disabled | Reason | Owner | Follow-up |
| -------- | ------------- | ------ | ----- | --------- |

Human-readable summary only — CI validates `a11y-exceptions.json`. Each exception requires:

- `storyId` (must match `critical-stories.json`)
- `rule` (axe rule id)
- `owner`
- `reason`
- `reviewedOn` (ISO date)
- `expiry` (ISO date; stale exceptions fail the gate)

Global axe rule weakening is not allowed. Use story-level `parameters.a11y.config` only when the
violation is a documented false positive or intentionally unsupported demo pattern, and register the
exception in `a11y-exceptions.json`.

`parameters.a11y.disable = true` is never allowed on protected stories.

## Quarantine policy

Flaky or temporarily broken stories must not be permanently `skip()`'d. Any quarantine requires a
linked issue, owner, reason, and expiry date recorded in this file and `a11y-exceptions.json`.
