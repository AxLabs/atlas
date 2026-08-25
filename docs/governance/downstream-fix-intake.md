# Atlas downstream fix intake

Use this template when a downstream Atlas-derived project discovers a fix that should land in
canonical Atlas. Copy the sections into a GitHub issue or internal ticket.

See [upgrades.md](../how-we-build/upgrades.md) for the upstream propagation lifecycle.

## Source

| Field                                             | Value |
| ------------------------------------------------- | ----- |
| Downstream project                                |       |
| Atlas baseline (`platform.baseline.atlasVersion`) |       |
| Current Atlas version evaluated against           |       |
| Reporter                                          |       |

## Ownership classification

| Field                                                                           | Value |
| ------------------------------------------------------------------------------- | ----- |
| Affected surface                                                                |       |
| Ownership category (package / synced template / generated / independent / docs) |       |
| Manifest path or category (if applicable)                                       |       |

## Problem

**Observed behavior:**

**Expected behavior:**

**Impact:**

## Consumer-specific context

Does the downstream project customize this surface?

If yes, how?

## Reproduction

**Minimal reproduction:**

**Reference / web reproduction (if applicable):**

## Proposed upstream fix

| Field                                                              | Value |
| ------------------------------------------------------------------ | ----- |
| Canonical owner (package, `apps/web` synced path, generator, docs) |       |
| Proposed change                                                    |       |

## Provenance

| Field                              | Value |
| ---------------------------------- | ----- |
| Original downstream implementation |       |
| Relevant commit / PR               |       |

## Affected consumers

Known affected Atlas-derived projects:

## Regression evidence

**Tests required:**

**Reference scenario:**

**Security implications:**

## Propagation

| Field                        | Value |
| ---------------------------- | ----- |
| Atlas release containing fix |       |
| Migration / adoption notes   |       |
