# Accessibility exceptions

Atlas runs automated axe checks against every Storybook story in CI via `@storybook/test-runner` and
`axe-playwright`. Exceptions must stay narrow and documented here.

| Story ID               | Rule disabled | Reason                                                | Owner       | Follow-up |
| ---------------------- | ------------- | ----------------------------------------------------- | ----------- | --------- |
| `ui-empty--with-image` | `image-alt`   | Decorative inline SVG illustration uses `aria-hidden` | `@atlas/ui` | —         |

Global axe rule weakening is not allowed. Use story-level `parameters.a11y.config` only when the
violation is a documented false positive or intentionally unsupported demo pattern.

## Quarantine policy

Flaky or temporarily broken stories must not be permanently `skip()`'d. Any quarantine requires a
linked issue, owner, reason, and expiry date recorded in this file.
