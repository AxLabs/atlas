# Consent Management

Atlas provides an optional cookie consent layer via `@atlas/consent`. It is **not** enabled by
default and is **not** legal compliance by itself.

## When to use it

Enable consent when your app:

- Uses analytics or marketing cookies that require opt-in in your jurisdiction
- Wants a consistent Atlas-themed banner and preferences modal
- Needs to gate Atlas analytics (`analytics.setConsent`) from user choice

Skip it when your app has no optional cookies, or when you must use a certified CMP (IAB TCF,
Google-certified CMP for ads, etc.).

## Package

`@atlas/consent` wraps [Orest Bida CookieConsent v3](https://cookieconsent.orestbida.com/)
(`vanilla-cookieconsent` on npm).

Public API:

- `ConsentProvider`, `useConsent`
- `createAtlasCookieConsentConfig`, `AtlasConsentConfig`
- `hasConsentForCategory`, `hasConsentForService`, `openConsentPreferences`
- `ConsentGate`, `runWhenConsentGranted`
- `CONSENT_CATEGORIES`, `CONSENT_SERVICES`

Import styles once in the app (handled automatically when consent initializes) or via:

```typescript
import "@atlas/consent/styles.css";
```

Atlas theme tokens from `@atlas/ui/globals.css` style the banner in light and dark mode.

## Wiring in `@atlas/web`

1. Set env vars (see `.env.example`)
2. Configure `apps/web/src/lib/consent/config.ts`
3. `MainProvider` wraps `ConsentBridge` → `ConsentProvider` → `AnalyticsProvider`

Provider order:

```
FeatureFlagsProvider
  ThemeProvider
    ToasterProvider
      ConsentProvider
        AnalyticsProvider (consentGranted from useConsent)
          children
```

When `NEXT_PUBLIC_CONSENT_ENABLED` is not `true`, the banner does not appear and analytics consent
remains denied by default (same as before the consent layer).

When enabled:

- Analytics is denied until the user accepts the analytics category
- Accepting analytics calls `analytics.setConsent(true)` on PostHog and GA adapters
- Rejecting calls `analytics.setConsent(false)`

## Environment variables

| Variable                         | Description                  | Default    |
| -------------------------------- | ---------------------------- | ---------- |
| `NEXT_PUBLIC_CONSENT_ENABLED`    | Enable consent UI and gating | `false`    |
| `NEXT_PUBLIC_CONSENT_MODE`       | `opt-in` or `opt-out`        | `opt-in`   |
| `NEXT_PUBLIC_CONSENT_REVISION`   | Bump to re-prompt users      | `1`        |
| `NEXT_PUBLIC_PRIVACY_POLICY_URL` | Privacy policy link          | `/privacy` |
| `NEXT_PUBLIC_COOKIE_POLICY_URL`  | Cookie policy link           | `/cookies` |
| `NEXT_PUBLIC_CONTACT_URL`        | Contact link                 | `/contact` |

Follow the standard env workflow in [env.md](./env.md).

## CSP

CookieConsent JS/CSS is bundled from npm — no extra CDN `script-src` is required.

Consent does **not** relax CSP. If you enable external analytics:

- **Google Analytics**: add `googletagmanager.com` / `google-analytics.com` to `CSP_SCRIPT_SRC` and
  `CSP_CONNECT_SRC` as needed
- **PostHog**: add your PostHog host to `CSP_CONNECT_SRC`

The existing nonce pattern for inline scripts must remain intact. Do not add `unsafe-inline` for
scripts.

## Demo

Visit `/demo/consent` with `NEXT_PUBLIC_CONSENT_ENABLED=true` to inspect state and test the
preferences modal.

## Legal disclaimer

This is a technical consent implementation. Atlas does not claim to be a certified CMP. Consult
legal counsel for compliance in your jurisdictions.
