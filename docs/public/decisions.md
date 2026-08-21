# Decisions

> Key engineering choices and their tradeoffs.

---

This document summarizes major architectural decisions in Atlas. Each entry explains the decision,
the reasoning, and the tradeoffs accepted. These are distilled from internal analysis—what matters
is the thinking, not the debate.

---

## Frontend-First Platform

### Decision

Atlas prioritizes the frontend as the primary product surface. The platform is designed around
browser behavior, user experience, and frontend developer productivity.

### Why

- Users interact with the frontend—it's literally the product
- Frontend complexity has grown; it deserves platform investment
- Most reliability and performance issues manifest in the frontend
- Teams with strong frontend foundations ship faster

### Tradeoffs

- **Accepted:** Backend patterns are influenced by frontend needs, not the reverse
- **Accepted:** Some backend-centric teams may find the model unfamiliar
- **Mitigated:** Backend integration is still first-class via API contracts

---

## Contract-Driven APIs

### Decision

All client-server communication flows through typed contracts defined in OpenAPI specifications.
Types are generated, not hand-written.

### Why

- Type mismatches between client and server cause production bugs
- Hand-written types drift from reality
- Generated types make contract changes explicit
- Compile-time errors are cheaper than runtime errors

### Tradeoffs

- **Accepted:** OpenAPI spec must be maintained as source of truth
- **Accepted:** Code generation step adds to build process
- **Mitigated:** Generation is fast and can be automated

---

## Cookie-Based Authentication

### Decision

Authentication uses httpOnly cookies for session storage. Tokens never reach browser JavaScript.

### Why

- localStorage is vulnerable to XSS attacks
- httpOnly cookies are inaccessible to JavaScript
- Server-side token management is simpler and more secure
- CSRF protection is more straightforward than XSS protection

### Tradeoffs

- **Accepted:** Requires CSRF protection (handled via SameSite and state validation)
- **Accepted:** Cookies have size limits (sufficient for session data)
- **Mitigated:** Cross-origin concerns addressed in architecture

---

## Custom OAuth Implementation

### Decision

Atlas implements OAuth 2.0 with PKCE directly instead of using libraries like NextAuth.js.

### Why

- Full control over the authentication flow
- No abstraction layers hiding security-critical behavior
- Easier to customize for specific requirements
- Smaller dependency surface for security code

### Tradeoffs

- **Accepted:** More code to maintain
- **Accepted:** Security responsibility on the team
- **Mitigated:** Flow is well-documented and follows RFC specifications

---

## CSS-First Theming

### Decision

Theming uses CSS custom properties with Tailwind CSS v4's CSS-first configuration. No JavaScript
theme libraries.

### Why

- CSS custom properties are the browser's native theming mechanism
- No runtime JavaScript for theme application
- Theme changes are instant via class swap
- Tailwind v4 embraces this approach

### Tradeoffs

- **Accepted:** Custom theme hook maintained instead of using libraries
- **Accepted:** Team needs to understand CSS custom properties
- **Mitigated:** Pattern is simpler than JavaScript-based alternatives

---

## React Query for Data Fetching

### Decision

All client-side data fetching uses React Query (TanStack Query) with a centralized API client.

### Why

- Consistent caching and invalidation patterns
- Built-in loading, error, and stale states
- Prevents scattered fetch calls throughout components
- DevTools for debugging cache behavior

### Tradeoffs

- **Accepted:** Learning curve for React Query patterns
- **Accepted:** More boilerplate per feature (hooks, keys)
- **Mitigated:** Patterns are standardized and documented

---

## Build-Time Environment Validation

### Decision

All environment variables are validated at build time using schema-based validation. No direct
`process.env` access.

### Why

- Missing variables discovered immediately, not in production
- Type safety for environment configuration
- Client/server separation enforced
- Self-documenting via schemas

### Tradeoffs

- **Accepted:** Multiple files must be updated when adding variables
- **Accepted:** Build requires all variables to be present
- **Mitigated:** Validation script catches issues before CI fails

---

## No Magic Frameworks

### Decision

Atlas uses explicit patterns over "magic" solutions. Configuration is visible, behavior is
predictable.

### Why

- Magic becomes technical debt when you need to customize
- Explicit patterns are debuggable
- New team members can read and understand behavior
- Fewer "how does this work?" investigations

### Tradeoffs

- **Accepted:** More initial code than magic solutions
- **Accepted:** Requires documentation of patterns
- **Mitigated:** Patterns are stable and rarely need changes

---

## Feature Module Organization

### Decision

Business logic lives in feature modules that are self-contained. Features don't import from other
features.

### Why

- Clear ownership boundaries
- Easy to find code for a given domain
- Prevents cross-cutting dependencies
- Enables potential future code splitting

### Tradeoffs

- **Accepted:** Shared logic must be extracted to infrastructure
- **Accepted:** Some duplication between features is acceptable
- **Mitigated:** Clear guidelines on when to extract

---

## Observability with Sentry

### Decision

Error tracking and performance monitoring uses Sentry across all runtimes (client, server, edge).

### Why

- Source maps make errors readable
- Cross-runtime visibility in one place
- Good Next.js integration
- Established tool with active development

### Tradeoffs

- **Accepted:** Third-party dependency for observability
- **Accepted:** Source maps uploaded to external service
- **Mitigated:** Graceful degradation when not configured

---

## Private Template, Client Access

### Decision

Atlas is a private repository template for selected clients and authorized evaluators—not a public
open-source offering.

### Why

- Delivery through engagements with explicit access terms
- Freedom to evolve without anonymous-consumer compatibility pressure
- Focus on client outcomes rather than community management
- Public docs explain capabilities; source access is controlled

### Tradeoffs

- **Accepted:** No anonymous public forks or inspections
- **Accepted:** Licensing and public access model still being defined
  ([#19](https://github.com/blitzcraftlabs/atlas/issues/19))
- **Mitigated:** Forkable for authorized clients under engagement terms

---

## Soft Monorepo Structure

### Decision

Atlas uses a monorepo with shared packages, but packages are internal—not published to npm.

### Why

- Shared code without publish/version overhead
- Single repository for all platform code
- TypeScript paths provide clean imports
- Consistent tooling across packages

### Tradeoffs

- **Accepted:** No external package reuse
- **Accepted:** Monorepo tooling has learning curve
- **Mitigated:** Structure is stable and well-documented

---

## Accessibility Baseline via Linting

### Decision

Common accessibility issues are ESLint errors via `eslint-plugin-jsx-a11y`, supplemented by
Storybook a11y review and documented keyboard checks.

### Why

- Accessibility is a requirement, not a suggestion
- Automatable rules catch high-value issues early
- Manual review covers patterns lint cannot enforce
- Establishes a baseline before formal conformance work

### Tradeoffs

- **Accepted:** Developers must fix jsx-a11y violations before merging
- **Accepted:** Not equivalent to WCAG conformance or CI a11y gates
- **Mitigated:** [#16](https://github.com/blitzcraftlabs/atlas/issues/16) tracks Storybook/a11y CI

---

## Summary

| Decision                  | Core Reasoning               |
| ------------------------- | ---------------------------- |
| Frontend-first            | Users interact with frontend |
| Contract-driven APIs      | Type safety prevents drift   |
| Cookie-based auth         | Security by architecture     |
| Custom OAuth              | Full control over security   |
| CSS-first theming         | Native browser mechanism     |
| React Query               | Consistent data patterns     |
| Build-time env validation | Fail early                   |
| No magic frameworks       | Debuggable behavior          |
| Feature modules           | Clear boundaries             |
| Sentry observability      | Cross-runtime visibility     |
| Private client template   | Controlled access model      |
| Soft monorepo             | Shared code without publish  |
| Accessibility linting     | Baseline, not full WCAG CI   |

Each decision reflects a belief about what makes production applications reliable, maintainable, and
secure.

---

## Further Reading

- [Architecture](architecture.md) — How these decisions manifest in system design
- [Capabilities](capabilities.md) — What these decisions enable
- [FAQ](faq.md) — Common questions about Atlas choices
