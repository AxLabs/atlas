/**
 * No-op Sentry router transition handler when NEXT_PUBLIC_SENTRY_DSN is unset.
 */

export function onRouterTransitionStart(): void {
  // Sentry disabled — no route transition instrumentation
}
