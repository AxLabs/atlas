# Postmortem 0001 — Atlas reference app controlled deployment failure

**Type:** Controlled operational exercise  
**Reference application:**
[blitzcraftlabs/atlas-reference-app](https://github.com/blitzcraftlabs/atlas-reference-app)  
**Atlas baseline:** `@blitzcraftlabs/atlas@1.1.0`  
**Customer impact:** None

## Summary

A standalone application generated from the published Atlas npm package was deployed to Vercel and
used to exercise Atlas's documented operational model outside the canonical monorepo.

A deliberate health-check failure was introduced through a normal Git commit and production
deployment. The failure was detected by the reference app's production smoke check, diagnosed, and
recovered by promoting the last known-good Vercel deployment. Production health was then verified
again.

The full reference-app postmortem, including the application-specific implementation details, is
published at:

- [atlas-reference-app postmortem](https://github.com/blitzcraftlabs/atlas-reference-app/blob/main/docs/operations/postmortems/0001-controlled-deployment-failure.md)

## Impact

- No customer impact; this was a controlled reference exercise.
- `/api/health` deliberately returned HTTP 503.
- Public HTML routes remained available by design.

## Detection

The production smoke check detected the failing health endpoint. Manual verification confirmed the
HTTP 503 response.

The reference application also contains a scheduled GitHub Actions synthetic check for the
production deployment.

## Timeline

All timestamps are UTC and were recorded during the exercise.

| Time                 | Event                                                               |
| -------------------- | ------------------------------------------------------------------- |
| 2026-09-20T16:58:34Z | Bad production deployment initiated from commit `0262948`           |
| 2026-09-20T16:59:22Z | Failure detected by production smoke check; health returned 503     |
| 2026-09-20T16:59:23Z | Incident acknowledged and deliberate failure flag identified        |
| 2026-09-20T16:59:25Z | Rollback initiated                                                  |
| 2026-09-20T17:00:40Z | Previous healthy deployment promoted and smoke check returned green |

Bad deployment: `dpl_GpYT9BM9ETVxbCGGanau5Njh1TJ4`

Restored deployment: `dpl_5Vs4ap7QXimwGLJxM23mZGTwvMRw`

## Root cause

The reference application deliberately enabled its controlled incident flag, causing the health
endpoint to report failure. This was an intentional test condition rather than an Atlas platform
defect.

## Recovery

The operator promoted the previous known-good Vercel deployment. Recovery was verified against the
production URL with the reference app's smoke script and health endpoint.

The deliberate failure was then removed from the desired state on `main`.

## What worked

- The external consumer application was generated from the published Atlas package rather than the
  Atlas monorepo.
- Consumer CI and browser E2E run successfully on GitHub-hosted runners.
- Production identity can be traced to source commit `9283efb185891e9e58c2362312dce0ad3b81935e`,
  which has successful CI and E2E runs.
- The health check made the controlled failure immediately observable.
- Promoting the previous immutable deployment restored service quickly.
- The smoke check provided a deterministic recovery verification step.

## What did not work as expected

The Vercel CLI `rollback` command did not move the production alias during this exercise. Promoting
the previous known-good deployment was the effective rollback mechanism and is the procedure
documented by the reference application.

## Corrective actions and follow-up

- Document the tested Vercel promote-based rollback path — completed in the reference app.
- Keep production smoke checks executable independently of the hosting platform — completed.
- Maintain scheduled external synthetics for the live reference deployment — configured in the
  reference app.
- Keep platform-versus-consumer operational ownership explicit — documented in the reference app.
- Preserve this sanitized Atlas-side record as public operational evidence for issue #11.

## Responsibility boundary

Atlas provides the application architecture, generated CI baseline, Doctor, health/observability
patterns, and operational reference guidance.

Consumers remain responsible for their hosting account, secrets, deployment permissions, monitoring
destinations, alert routing, SLO selection, and incident ownership.

## Evidence

- Reference repository: https://github.com/blitzcraftlabs/atlas-reference-app
- Live deployment: https://atlas-reference-app.vercel.app
- Reference-app postmortem:
  https://github.com/blitzcraftlabs/atlas-reference-app/blob/main/docs/operations/postmortems/0001-controlled-deployment-failure.md
- Atlas operations tracking: https://github.com/blitzcraftlabs/atlas/issues/11
