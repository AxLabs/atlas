# ADR-0010: Atlas Upgrades and Downstream Fix Propagation

## Status

**Accepted**

## Context

Atlas is a **source-owned** frontend platform. Consumers fork the monorepo (or a future public
snapshot), customize product code, and often customize infrastructure wiring. Atlas continues to
ship fixes to auth, API infrastructure, security, UI packages, generators, and conventions.

ADR-0009 (#57 / PR #58) established **ownership classification** and **monorepo template sync**
between `apps/web` and `apps/reference`. It intentionally does not define how an external consumer
six months behind receives fixes without overwriting product work.

Issue #17 scopes the **upgrade contract**, conflict policy, baseline metadata, security propagation
model, downstream→upstream lifecycle, and a reproducible upgrade rehearsal. Executable migration
tooling belongs in #43 — not here.

## Decision

### 1. Upgrade follows semantic ownership (ADR-0007 / ADR-0009)

Every Atlas surface has a deliberate upgrade channel derived from ownership — not from incidental
byte equality today.

| Ownership channel             | Examples                                        | Upgrade mechanism (v0.1)                        |
| ----------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| Versioned package             | `@atlas/ui`, `@atlas/consent`, `@atlas/config`  | Monorepo/workspace version bump + changelog     |
| Generated artifact            | OpenAPI `schema.ts`                             | `pnpm api:gen` / `pnpm api:check`               |
| Atlas-managed template        | Manifest `syncedPaths` under `apps/web`         | Selective replace when baseline checksums match |
| Consumer-owned source         | Product features, routes, shell composition     | Never overwrite automatically                   |
| Application-owned wiring      | Manifest `independentPaths`                     | Manual review; divergence allowed               |
| Structural contract           | `atlas.config.json`, ESLint architecture policy | Doctor + migration guides (#43)                 |
| Migration-managed             | Breaking directory/generator output changes     | Documented migration chain (#43)                |
| Documentation / procedure     | Conventions, ADRs                               | Upgrade guide only                              |
| Reference-only / starter-only | `apps/reference`, `/examples`                   | Optional; out of consumer upgrade scope         |

### 2. Record an Atlas platform baseline at bootstrap

`atlas.config.json` gains an optional `platform.baseline` object (contract schema v1 extension):

| Field                           | Purpose                                                         |
| ------------------------------- | --------------------------------------------------------------- |
| `atlasVersion`                  | Atlas repository snapshot SemVer at last recorded baseline      |
| `contractSchemaVersion`         | `atlas.config.json` schema version at baseline                  |
| `templateManifestSchemaVersion` | `templates/app-infrastructure.manifest.json` schema at baseline |
| `syncedPathChecksums`           | SHA-256 of each manifest `syncedPaths` file at baseline         |

`atlas init` records this metadata on first initialization when the infrastructure manifest is
present. #43 will refresh it after successful upgrades.

**Version concepts (minimal):**

| Concept                          | Source                              | Used for                           |
| -------------------------------- | ----------------------------------- | ---------------------------------- |
| Atlas release version            | Root `package.json` / git tag       | Primary consumer baseline identity |
| Contract schema version          | `atlas.config.json` `schemaVersion` | Contract migrations (#43)          |
| Template manifest schema version | Manifest `schemaVersion`            | Sync policy migrations             |
| CLI snapshot version             | `@atlas/cli` package version        | Doctor tooling drift warnings      |

We do **not** introduce independent per-file or per-package baseline version numbers in v0.1.

### 3. Detect consumer modifications with baseline checksums

**Chosen strategy:** baseline checksums for manifest `syncedPaths`, plus manifest `independentPaths`
for explicitly consumer-owned wiring.

At upgrade time for each synced path:

1. Compare consumer file checksum to **recorded baseline checksum**.
2. If different → **merge-required** (consumer modified); never auto-replace.
3. If equal and Atlas target changed → **patch-safe replace** (or **security-critical** when path is
   security-relevant).
4. If equal and Atlas target unchanged → skip.

**Rejected alternatives:**

| Approach                    | Why rejected for v0.1                                               |
| --------------------------- | ------------------------------------------------------------------- |
| Git ancestry / merge-base   | Cannot assume clean fork topology or preserved upstream history     |
| Byte-identical only         | Cannot distinguish consumer edits from Atlas edits                  |
| Full three-way merge engine | Correct long-term; belongs in #43 with release snapshot artifacts   |
| Separate checksum file      | Duplicates contract ownership; baseline belongs in project contract |

Release snapshot artifacts for true three-way merge are a #43 requirement, not a #17 deliverable.

### 4. Conflict policy

> **Consumer modifications win unless the operator explicitly merges Atlas changes.**

Atlas must **never silently overwrite** consumer modifications to synced template infrastructure.
Conflicts are **deterministic**, **machine-representable**, and surfaced before writes.

### 5. Upgrade change taxonomy (v0.1)

| Category             | Meaning                                        | Typical action            |
| -------------------- | ---------------------------------------------- | ------------------------- |
| `patch-safe`         | Low-risk; consumer copy still matches baseline | Replace / regenerate      |
| `merge-required`     | Atlas and consumer both changed same surface   | Manual review             |
| `migration-required` | Contract/generator breaking change             | Run migration (#43)       |
| `manual`             | Application-owned or architectural choice      | Human decision            |
| `security-critical`  | Security fix on untouched synced path          | Urgent patch-safe replace |

### 6. Security propagation (local contract; #14 owns advisories)

When Atlas ships a security fix in template-owned infrastructure:

1. **Identify affected versions** via release notes / future security advisories (#14).
2. **Doctor** can compare `platform.baseline.atlasVersion` to patched release range.
3. **Untouched synced paths** receive urgent patch-safe replacement.
4. **Consumer-modified security paths** surface `merge-required` with security-critical severity —
   never silent overwrite.
5. Package-based fixes (`@atlas/ui`, etc.) follow workspace version bumps independently.

### 7. Downstream → upstream propagation

Client-discovered bugs in Atlas-owned infrastructure follow:

1. **Classify ownership** using architecture-ownership.md + manifest.
2. **Reproduce** in Atlas canonical starter (`apps/web`) or reference app when relevant.
3. **Fix canonical ownership** (package, synced path, generator, or docs).
4. **Add regression tests** in the owning package/app.
5. **Release** new Atlas snapshot; consumers upgrade via this contract.

Consumers do not become the source of truth — they contribute fixes through Atlas canonical paths.

### 8. Upgrade rehearsal (evidence for #43)

`packages/cli/src/upgrade/` provides an **internal** planner and safe-apply helper (test-only, not a
public `atlas upgrade` command). `upgrade-rehearsal.test.ts` simulates:

- unchanged synced infrastructure → safe replace
- customized auth/session → merge conflict
- generated OpenAPI → regenerate
- independent wiring → manual review
- product features → untouched

### 9. Supported upgrade promise (v0.1 — conservative)

| Topic                         | v0.1 promise                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------ |
| Upgrade span                  | Documented migration chain for adjacent intentional releases when available    |
| Arbitrary historical upgrades | **Not promised** — may require stepping through migrations or manual work      |
| Automatic upgrades            | **Not promised** — only deterministic proposals + safe auto-apply in tests     |
| Migration retention           | While pre-1.0; at least one minor release notice before removal when practical |
| Unsupported baselines         | Doctor warns; Atlas reports manual upgrade required                            |

### 10. #43 boundary

#17 defines **what** must be automated. #43 implements:

- `atlas upgrade` / `atlas migrate` commands
- release snapshot artifacts for three-way merge
- dry-run, JSON output, baseline refresh
- contract schema migrations

## Alternatives Considered

### Single `atlas migrate` command now

Rejected — duplicates #43 scope and risks shipping unsafe auto-overwrites before conflict policy is
proven.

### Store baseline only in git tags

Rejected — consumers may copy templates without preserving git topology; contract must be
self-describing.

### Promote all infrastructure to packages

Rejected in ADR-0009 — poor fit for forkable, editable source.

## Consequences

### Positive

- Clear, testable upgrade contract aligned with existing ownership model
- Conflict detection without requiring git history
- Evidence-backed requirements for #43
- Security path defined without duplicating #14 advisory backend

### Negative

- `platform.baseline.syncedPathChecksums` can be large — acceptable for machine metadata
- Baseline must be refreshed after upgrades (#43)
- Full three-way merge still manual until #43

## References

- [upgrades.md](../how-we-build/upgrades.md)
- [architecture-ownership.md](../how-we-build/architecture-ownership.md)
- ADR-0007, ADR-0008, ADR-0009
- Issue #17 — upgrade contract and rehearsal
- Issue #43 — migration tooling
- Issue #14 — security release artifacts
- Issue #34 — platform epic
