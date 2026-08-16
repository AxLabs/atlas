# Archived Documentation

> **Historical only — not canonical.** Do not use this directory for current implementation
> guidance.

This directory preserves documentation superseded by the December 2025 documentation reset and later
platform work. Content here may describe outdated architecture, dependencies, or behavior.

## Canonical sources (use these instead)

| Need                   | Location                                                     |
| ---------------------- | ------------------------------------------------------------ |
| Coding agents          | [AGENTS.md](../../AGENTS.md)                                 |
| Public capabilities    | [docs/public/](../public/README.md)                          |
| Platform conventions   | [docs/how-we-build/](../how-we-build/README.md)              |
| Architecture decisions | [docs/adr/](../adr/README.md)                                |
| Claims and evidence    | [docs/audit/claims-register.md](../audit/claims-register.md) |
| Contributing           | [CONTRIBUTING.md](../../CONTRIBUTING.md)                     |

Engineers and coding agents **must** verify any archived statement against current source before
copying patterns into new work.

## Why archive?

Rather than delete historical documentation, we preserve it to:

- trace the evolution of platform decisions;
- recover context behind current patterns;
- avoid re-litigating resolved debates.

## Archive contents

### 2025-12-pre-platform-docs/

Documentation that existed before the December 2025 documentation reset. These files may be
outdated, duplicated, or inconsistent with current implementation.

**Status:** Superseded by `docs/how-we-build/`, `docs/public/`, and `docs/adr/`

## Rules

1. **Do not modify archived content** — preserve original state except for archive warning banners.
2. **Do not reference archived docs as authoritative** — canonical docs must not link here (enforced
   by `pnpm docs:check`).
3. **Do not add new current guidance here** — place new docs in `AGENTS.md`, `docs/public`,
   `docs/how-we-build`, or `docs/adr`.
4. **Experimental drafts** may land here temporarily before promotion or deletion.

## Navigation and search

Archived material is excluded from canonical documentation indexes and should not appear in
onboarding paths. Tools may still scan archive files for broken links, but policy violations are
flagged when canonical docs link into this tree.
