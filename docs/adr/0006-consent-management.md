# ADR-0006: Optional Consent Management with CookieConsent v3

## Status

**Accepted**

## Context

Atlas apps may use analytics (PostHog, GA4) and other optional cookies. Regulations such as GDPR
often require opt-in consent before non-essential cookies are set. Teams need a lightweight,
framework-agnostic consent UI that integrates with Atlas analytics without hardcoding a banner into
every app.

Constraints:

- Consent must be **optional** — not every Atlas app needs a CMP
- Implementation belongs in a shared package, not inlined in `apps/web`
- Must work with existing `analytics.setConsent()` and GA Consent Mode v2
- Must not weaken CSP or break the nonce pattern
- Must not claim legal compliance or certified CMP status

## Decision

We will provide `@atlas/consent`, an optional package built on
[Orest Bida CookieConsent v3](https://github.com/orestbida/cookieconsent) via the npm package
`vanilla-cookieconsent`.

### What we will do

- Ship `@atlas/consent` with `ConsentProvider`, `useConsent`, category/service helpers, and
  Atlas-themed CSS
- Wire `@atlas/web` through app-level config (`lib/consent/config.ts`) and `ConsentBridge` in
  `MainProvider`
- Gate analytics via `analytics.setConsent()` when the analytics category is accepted or rejected
- Default consent to **disabled** (`NEXT_PUBLIC_CONSENT_ENABLED=false`)
- Document CSP requirements for external analytics separately from consent

### What we won't do

- Mandate consent for every Atlas app
- Claim Atlas is a certified CMP or provide legal compliance guarantees
- Support IAB TCF or Google-certified CMP requirements in this package
- Add CDN script-src for CookieConsent (bundle from npm)
- Weaken CSP with `unsafe-inline` scripts

### Key implementation details

- CookieConsent initializes client-side only via dynamic `import("vanilla-cookieconsent")`
- Categories: `necessary` (read-only), `analytics`, `marketing`, `preferences`
- Default services: GA, PostHog (analytics); Google Ads, Meta Pixel (marketing); theme, language
  (preferences)
- GDPR-friendly `opt-in` mode by default; marketing disabled by default
- `AnalyticsProvider` initializes once and syncs consent changes via `useEffect` +
  `analytics.setConsent`

## Alternatives Considered

### Alternative 1: Inline banner in apps/web

**Pros:** Fastest initial delivery

**Cons:** Not reusable; violates platform package model

**Why not chosen:** Atlas shared capabilities belong in `packages/*`

### Alternative 2: Commercial CMP (OneTrust, Cookiebot, etc.)

**Pros:** Certified, legal review, TCF support

**Cons:** Cost, vendor lock-in, heavier integration

**Why not chosen:** Overkill for optional open-source layer; apps needing certification should
integrate their own CMP

### Alternative 3: Custom React banner

**Pros:** Full UI control

**Cons:** Reinventing script gating, cookie clearing, accessibility, and maintenance

**Why not chosen:** CookieConsent v3 is MIT-licensed, lightweight, and battle-tested

## Consequences

### Positive

- Optional, reusable consent layer across Atlas apps
- Analytics consent stays in sync with user choice
- Atlas-themed UI via CSS variables
- Clear separation: package vs app config vs legal responsibility

### Negative

- Apps needing IAB TCF or ad-certified CMP must use a different solution
- Consent revision bumps require operational discipline
- CSP for third-party analytics remains a separate configuration step

### Neutral

- Consent is app-level because each app has different cookies, vendors, jurisdictions, and policies

## References

- [CookieConsent v3 documentation](https://cookieconsent.orestbida.com/)
- [how-we-build/consent.md](../how-we-build/consent.md)
- [ADR-0005: Observability with Sentry](./0005-observability-sentry.md)
