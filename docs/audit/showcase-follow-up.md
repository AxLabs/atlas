# Atlas Showcase follow-up audit

**Date:** 2026-08-16  
**Atlas issue:** [#13](https://github.com/blitzcraftlabs/atlas/issues/13)  
**Showcase follow-up issue:**
[blitzcraftlabs/atlas-showcase#12](https://github.com/blitzcraftlabs/atlas-showcase/issues/12)  
**Status:** Showcase **not** corrected by this PR. Apply changes in the atlas-showcase repository
separately.

This document lists Showcase claims and CTAs that require alignment with Atlas repository evidence
after the claims register work lands. Exact Showcase paths may drift; verify against the current
showcase repository before editing.

## Summary

| Theme                              | Atlas evidence to cite                                                          | Showcase action                           |
| ---------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------- |
| Repository access                  | Private repo; engagement-based access (`CONTRIBUTING.md`, `docs/public/faq.md`) | Qualify Docs / GitHub CTAs                |
| Forkable / inspectable             | [Claims register — C-001](claims-register.md)                                   | Replace public-fork wording               |
| Production / battle-tested         | Approved product categories in claims register                                  | Qualify with product lists + limitations  |
| Accessibility / security / testing | Qualified claims C-006, C-007, C-014                                            | Remove absolute language                  |
| Licensing                          | No root `LICENSE`; [#19](https://github.com/blitzcraftlabs/atlas/issues/19)     | Remove MIT or public-license implications |

## Items requiring separate Showcase changes

### 1. Private repository and Docs links

**Typical Showcase copy (paraphrased):** “View source on GitHub”, “Read the docs”, or equivalent
links that assume anonymous access.

**Problem:** The Atlas source repository is private. Public docs describe behavior; they do not
grant repository access.

**Recommended replacement:** “Request access for source and engagement terms” or “Read public Atlas
documentation (source available to authorized clients)”.

**Atlas evidence:** `CONTRIBUTING.md`; `docs/public/faq.md` (access model); Epic
[#21](https://github.com/blitzcraftlabs/atlas/issues/21) gate for
[#15](https://github.com/blitzcraftlabs/atlas/issues/15).

### 2. “Forkable” and “inspectable” wording

**Typical Showcase copy:** “Fork Atlas today”, “inspect the codebase”, “open-source template”.

**Problem:** Conflicts with private, engagement-based access
([claims register C-002](claims-register.md)).

**Recommended replacement:** “Forkable for authorized clients under engagement terms” / “Technical
evaluation available by request”.

**Atlas evidence:** [Claims register — Forkable definition](claims-register.md#forkable);
`README.md`.

### 3. Production-ready and battle-tested hero copy

**Typical Showcase copy:** Unqualified “production-ready”, “battle-tested”, “runs in production
everywhere”.

**Problem:** Product-level evidence is not fully published in Atlas; capabilities vary by subsystem
([C-008](claims-register.md), [C-009](claims-register.md)).

**Recommended replacement:** “Battle-tested through named client products (see case studies)” with
explicit **built from Atlas** vs **migrated toward Atlas** categories.

**Atlas evidence:** Production history table in [claims-register.md](claims-register.md); follow-up
[atlas-showcase#11](https://github.com/blitzcraftlabs/atlas-showcase/issues/11).

**Approved product lists:**

- **Built from Atlas:** Aviatopia; BlitzCraft Studio (Publishing Platform); Ax402 Clients;
  thedanielmark-site; xgas-station-app; bridge-indexer-frontend
- **Migrated toward Atlas:** gitmyabi-app; cha-ching-app

### 4. Product-adoption categories

**Typical Showcase copy:** Single undifferentiated “powered by Atlas” or “Atlas customers” list.

**Problem:** Collapses greenfield builds and incremental migrations.

**Recommended replacement:** Two labeled sections matching the claims register categories; note
where chronology or metrics are unavailable.

**Atlas evidence:**
[claims-register.md — Production history](claims-register.md#production-history).

### 5. Accessibility claims

**Typical Showcase copy:** “WCAG compliant”, “accessibility enforced in CI”, “violations fail the
build”.

**Problem:** Atlas enforces jsx-a11y via ESLint; no WCAG audit or dedicated a11y CI gate yet
([C-006](claims-register.md)).

**Recommended replacement:** “Accessibility-oriented baseline: semantic components, jsx-a11y
linting, Storybook a11y review; formal conformance programme planned.”

**Atlas evidence:** `docs/how-we-build/accessibility.md`;
[#16](https://github.com/blitzcraftlabs/atlas/issues/16).

### 6. Security claims

**Typical Showcase copy:** “Enterprise security”, “audited dependencies block releases”, “secure by
default” without qualification.

**Problem:** Weekly `pnpm audit` workflow is non-blocking ([C-014](claims-register.md)); threat
model programme is [#14](https://github.com/blitzcraftlabs/atlas/issues/14).

**Recommended replacement:** “Documented secure defaults (httpOnly sessions, PKCE, env separation);
blocking security gates and independent review on the roadmap.”

**Atlas evidence:** `docs/public/capabilities.md` (Security section);
`.github/workflows/security-audit.yml`; [#14](https://github.com/blitzcraftlabs/atlas/issues/14),
[#20](https://github.com/blitzcraftlabs/atlas/issues/20).

### 7. Testing and coverage claims

**Typical Showcase copy:** “High test coverage”, “critical paths fully tested”, “coverage enforced
in CI”.

**Problem:** Coverage thresholds apply to `@atlas/ui` only; auth/API critical paths are undertested
([C-007](https://github.com/blitzcraftlabs/atlas/issues/12), [C-013](claims-register.md)).

**Recommended replacement:** “Automated unit, UI-package coverage, and Playwright E2E in CI;
expanded risk-based coverage programme in progress.”

**Atlas evidence:** `.github/workflows/ci.yml`; `packages/config/jest.config.js`;
[#12](https://github.com/blitzcraftlabs/atlas/issues/12).

### 8. Proof section wording

**Typical Showcase copy:** Proof panels that imply independent verification, uptime metrics, or
client endorsements without citations.

**Problem:** No in-repo substantiation for metrics or endorsements.

**Recommended replacement:** Label evidence type: **production product**, **repository CI**,
**synthetic example**, or **planned**; link to atlas-showcase case studies when published.

**Atlas evidence:** Epic [#21](https://github.com/blitzcraftlabs/atlas/issues/21);
[atlas-showcase#11](https://github.com/blitzcraftlabs/atlas-showcase/issues/11).

### 9. MIT / open license badges

**Typical Showcase copy:** MIT badge or “free to fork” license language.

**Problem:** No root `LICENSE` file; licensing policy open in
[#19](https://github.com/blitzcraftlabs/atlas/issues/19).

**Recommended replacement:** “License and usage terms provided with client access” until #19
resolves.

**Atlas evidence:** [C-003](claims-register.md);
[#19](https://github.com/blitzcraftlabs/atlas/issues/19).

### 10. Relationship to atlas-showcase Issue #12

Commercial CTO journey and hire-Daniel conversion path work belongs in
**[atlas-showcase#12](https://github.com/blitzcraftlabs/atlas-showcase/issues/12)**. This Atlas PR
only documents the evidence Showcase should reference; it does not implement the buyer journey.

Coordinate with Epic [#21](https://github.com/blitzcraftlabs/atlas/issues/21) so Showcase copy does
not outpace Atlas evidence gates.

## Verification after Showcase PR merges

- [ ] No CTA implies anonymous GitHub access without disclosure
- [ ] Hero claims use qualified terminology definitions from the claims register
- [ ] Product lists use exact built-from vs migrated-toward categories
- [ ] Proof sections label evidence provenance
- [ ] Licensing language matches #19 outcome

## Do not claim complete until

A separate atlas-showcase pull request merging the above changes has shipped. This Atlas repository
commit does **not** constitute Showcase correction.
