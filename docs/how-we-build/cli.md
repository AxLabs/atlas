# Atlas CLI

> **Atlas-specific command-line workflows for project contract awareness and bootstrap.**

The Atlas CLI exists only for workflows where Atlas owns meaningful semantics. It does **not**
replace pnpm, Next.js, Turborepo, Git, Changesets, shadcn, ESLint, TypeScript, or Playwright.

See also: [Atlas project contract](atlas-contract.md), [Agent workflow](agents.md),
[Releases and Governance](releases-and-governance.md).

---

## What the Atlas CLI owns

| Concern                | Example                                                                           |
| ---------------------- | --------------------------------------------------------------------------------- |
| Atlas project contract | Load `atlas.config.json` through `@atlas/project`                                 |
| Platform version       | `atlas --version` reports the installed `@atlas/cli` platform snapshot            |
| Project bootstrap      | `atlas init` initializes Atlas metadata in a compatible checkout                  |
| Atlas generators       | `atlas generate feature …`, `atlas generate page …`, `atlas generate list --json` |
| Agent project context  | `atlas context` / `atlas context --json`                                          |
| Architecture Doctor    | `atlas doctor` reports contract, boundary, and workspace drift                    |
| Upgrade workflows      | `atlas upgrade --to <version>` plans and applies supported release upgrades       |

---

## What the Atlas CLI does **not** own

Use the underlying tools directly:

| Instead of         | Use                                                        |
| ------------------ | ---------------------------------------------------------- |
| `atlas install`    | `pnpm install`                                             |
| `atlas dev`        | `pnpm dev`                                                 |
| `atlas test`       | `pnpm test`                                                |
| `atlas build`      | `pnpm build`                                               |
| `atlas lint`       | `pnpm lint`                                                |
| `atlas git …`      | `git …`                                                    |
| `atlas deploy`     | Your deployment platform                                   |
| `atlas add-button` | `pnpm dlx shadcn@latest add button` (or Atlas UI patterns) |
| `atlas release`    | Changesets + repository release workflow                   |

---

## Repository-local usage (current)

The CLI is a private workspace package (`@atlas/cli`) with an `atlas` binary. Maintainers invoke it
from the repository without npm publication:

```bash
pnpm install
pnpm --filter @atlas/cli build
pnpm atlas --help
pnpm atlas --version
pnpm atlas init --dry-run
pnpm atlas generate feature users --dry-run
pnpm atlas generate page settings/profile --json
```

The root `pnpm atlas` script runs the linked workspace binary via `pnpm exec atlas`.

---

## Future public distribution

`@atlas/cli` is an in-repo workspace package. It is **not** published to the public npm registry.
When local invocation is needed:

- Use `pnpm atlas` from a clone of this repository.
- Do not assume `npx atlas` against a public registry.
- Version numbers mirror the Atlas platform snapshot (`@atlas/monorepo` root `package.json`).

---

## Global options

| Option            | Description                                            |
| ----------------- | ------------------------------------------------------ |
| `--help`, `-h`    | Show help                                              |
| `--version`, `-v` | Show installed Atlas CLI/platform snapshot version     |
| `--json`          | Emit machine-readable JSON on stdout                   |
| `--cwd <path>`    | Resolve the Atlas repository from a starting directory |
| `--debug`         | Include stack traces for unexpected internal errors    |
| `--dry-run`       | Preview planned actions without writing files          |

---

## Commands (v0.1)

### `atlas init`

Initialize Atlas metadata in an **existing compatible checkout**. This command:

- Validates Node/pnpm prerequisites from root `package.json` `engines`
- Discovers the repository root (walks upward for `atlas.config.json` or structural layout)
- Resolves existing `atlas.config.json` through `@atlas/project` before treating the project as
  initialized
- Validates a proposed contract through `@atlas/project` before writing any files on first init
- Creates `atlas.config.json` when absent (minimal contract with `openApi: false` when OpenAPI
  artifacts are absent)
- Records `platform.baseline` (Atlas version + synced-path checksums) when the infrastructure
  manifest is present — see [upgrades](upgrades.md). When the manifest is present, baseline capture
  is **strict**: init fails rather than writing incomplete or silently absent upgrade evidence.
- Never silently overwrites an existing contract
- Plans all actions before writing files

Customization options (`--reference`, `--env`) apply **only during first initialization**.
Re-running `atlas init` on an already initialized valid Atlas project performs no mutations, even
when those flags are supplied.

| Init option   | Values           | Default |
| ------------- | ---------------- | ------- |
| `--reference` | `keep`, `remove` | `keep`  |
| `--env`       | `skip`, `copy`   | `skip`  |

`--env copy` copies `apps/web/.env.example` → `apps/web/.env.local` only when `.env.local` is
absent. Atlas never invent secrets or overwrite existing env files.

`--reference remove` deletes canonical reference/example surfaces declared by the contract defaults.
Reference removal requires an explicit flag; the default retains reference content.

There is **no** `create-atlas` command in v0.1 — bootstrap from this public repository clone.

### `atlas generate feature <name>`

Generate the minimum Atlas **product feature** structure under `project.features.product` from the
resolved contract. The generator loads architecture through `@atlas/project` — it does not hard-code
`apps/web/src/features`.

| Input            | Rule                                                             |
| ---------------- | ---------------------------------------------------------------- |
| Feature name     | kebab-case domain name (`users`, `billing-history`)              |
| Reserved names   | Rejects names that collide with contract reference/example roots |
| Existing feature | Conflict when `<features.product>/<name>/` already exists        |

**Default files**

| Path                           | Purpose                                             |
| ------------------------------ | --------------------------------------------------- |
| `components/<Name>Feature.tsx` | Route-facing feature composition shell              |
| `index.ts`                     | Public feature boundary exporting the feature shell |

**Optional flags**

| Flag         | Adds                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------- |
| `--query`    | `keys.ts`, `queries.ts`, query hook scaffold with explicit domain-owned fetch seam       |
| `--mutation` | `keys.ts`, `mutations.ts`, mutation hook scaffold with explicit domain-owned create seam |
| `--form`     | `schema.ts`, `components/<Name>Form.tsx` using `@atlas/ui` forms                         |
| `--tests`    | Deterministic query-key test scaffold (`__tests__/keys.test.ts`); requires `--query`     |

Optional flags augment the default feature structure. They do not replace the generated feature
component or public boundary.

Query and mutation scaffolds intentionally do **not** invent URLs, payload types, or CRUD semantics.
Generated network hooks contain explicit domain-owned implementation seams until the product API
contract is known.

When `capabilities.openApi` is `true`, query/mutation scaffolds remain compile-safe explicit seams
and do not fabricate typed OpenAPI client members.

**Examples**

```bash
atlas generate feature users
atlas generate feature billing-history --query --mutation
atlas generate feature account-settings --form --dry-run --json
```

**Not generated:** business logic, navigation wiring, fake CRUD APIs, reference/example modules, or
cross-feature imports.

### `atlas generate page <route>`

Generate a thin App Router page under `<application.root>/src/app/<route>/page.tsx`.

| Input          | Rule                                                                 |
| -------------- | -------------------------------------------------------------------- |
| Route          | Relative App Router fragment (`settings`, `settings/profile`)        |
| Dynamic routes | Identifier-safe segments such as `[id]` and `[userId]` are supported |
| Existing route | May add `page.tsx` when sibling route files already exist            |
| Conflict       | Fails when the intended `page.tsx` already exists (no overwrite)     |

**Examples**

```bash
atlas generate page settings/profile
atlas generate page admin/users --dry-run
```

**Not generated:** layouts, loading/error files, navigation updates, or domain logic inside the
route file.

Both generators:

- Require a valid initialized Atlas project (`atlas.config.json` + `@atlas/project`)
- Plan all files before writing; abort without mutation on conflict
- Support `--dry-run` and `--json` using the shared CLI output model
- Emit repository-relative paths and `followUpActions` for automation

### `atlas generate list`

List supported generators with machine-readable metadata for humans and coding agents.

```bash
atlas generate list
atlas generate list --json
```

JSON output includes generator `id`, `description`, `usage`, `targetOwnership`, `conflictBehavior`,
required/optional arguments, and supported flags. The same inventory is also available via
`atlas context --json` → `commands.generators`.

### `atlas context`

Emit resolved Atlas project state for humans and coding agents. This command composes the project
contract, ownership manifest, generator inventory, Doctor capabilities, upgrade semantics,
validation commands, and documentation references. It does not introduce a separate agent
architecture schema.

```bash
pnpm atlas context
pnpm atlas context --json
```

See [Agent workflow](agents.md) for how coding agents should use this output.

Machine output includes:

| Field                      | Purpose                                                   |
| -------------------------- | --------------------------------------------------------- |
| `contract`                 | Resolved `atlas.config.json` via `@atlas/project`         |
| `ownership`                | Manifest synced/generated/independent path classification |
| `commands.generators`      | Supported structural generators                           |
| `commands.doctor.checkIds` | Registered Doctor checks                                  |
| `commands.upgrade`         | Upgrade command capabilities and dry-run decision source  |
| `validation.recommended`   | Standard engineering validation commands                  |
| `documentation`            | Workflow doc, ADR references, canonical doc links         |

Reports are deterministic: stable `schemaVersion`, sorted paths, no timestamps.

### `atlas doctor`

Diagnose Atlas-specific architecture and configuration drift. Doctor validates the project contract,
workspace structure, architecture boundaries, high-confidence undeclared application dependencies,
generated OpenAPI freshness (when enabled), template infrastructure synchronization (when both
starter and reference applications are present), and Atlas version consistency.

Doctor does **not** replace `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, or security
audits. See [Atlas Doctor](doctor.md).

```bash
pnpm atlas doctor
pnpm atlas doctor --json
pnpm atlas doctor --cwd apps/web
```

Exit `0` for healthy or warning-only reports. Exit `8` when one or more error diagnostics are
present.

### `atlas sync infrastructure`

Synchronize duplicated Atlas template infrastructure from the canonical starter (`apps/web`) into
consumer applications (currently `apps/reference`) according to
`templates/app-infrastructure.manifest.json`.

```bash
pnpm template:check   # atlas sync infrastructure --check
pnpm template:sync    # atlas sync infrastructure
atlas sync infrastructure --dry-run --json
```

Use `--check` in CI to detect drift without copying files. Application-owned paths listed in the
manifest `independentPaths` are allowed to diverge (and may remain byte-identical to the starter).
`--dry-run` reports planned copies without writing files; both `--check` and `--dry-run` exit
non-zero when drift or unresolved structural issues exist. A mutating run re-validates after copies
and exits `0` when repairable drift is cleared. See
[architecture ownership](architecture-ownership.md#duplicated-starterreference-infrastructure).

### `atlas upgrade`

Plan and apply supported Atlas release upgrades using `platform.baseline` checksum evidence and
versioned release snapshots under `releases/<version>/`.

```bash
atlas upgrade --to 0.2.0 --dry-run
atlas upgrade --to 0.2.0
atlas upgrade --to 0.2.0 --json
```

| Option              | Description                                                   |
| ------------------- | ------------------------------------------------------------- |
| `--to <version>`    | Target Atlas release version (required)                       |
| `--dry-run`         | Full planning path without filesystem mutations               |
| `--json`            | Machine-readable plan and result on stdout                    |
| `--allow-dirty`     | Allow mutations when the Git worktree has uncommitted changes |
| `--skip-validation` | Skip post-upgrade `atlas doctor` (fixture/CI only)            |

Blocking conflicts refuse all mutations. `platform.baseline` advances only after a fully successful
apply and `atlas doctor` validation. See [upgrades](upgrades.md) and
[release snapshots](../../releases/README.md).

---

## Exit codes

| Code | Meaning                                                  |
| ---- | -------------------------------------------------------- |
| `0`  | Success                                                  |
| `1`  | Unexpected internal error                                |
| `2`  | Invalid CLI usage                                        |
| `3`  | Atlas project / contract not found                       |
| `4`  | Invalid Atlas contract or project                        |
| `5`  | Bootstrap conflict / incompatible checkout               |
| `6`  | Missing prerequisite (Node, pnpm)                        |
| `7`  | Generator conflict (destination exists)                  |
| `8`  | Doctor found architectural error diagnostics             |
| `9`  | Upgrade blocked (conflicts or dirty worktree)            |
| `10` | Upgrade prerequisite failure (baseline, snapshot, chain) |

---

## Output conventions

| Stream     | Contents                                        |
| ---------- | ----------------------------------------------- |
| **stdout** | Successful command output and `--json` payloads |
| **stderr** | Errors, warnings, diagnostics                   |

`--json` output is valid JSON only — no ANSI color, spinners, or decorative logging mixed into
stdout. Errors use:

```json
{
  "ok": false,
  "command": "init",
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "…"
  }
}
```

Success responses use:

```json
{
  "ok": true,
  "command": "init",
  "result": {}
}
```

---

## Project root discovery

1. Start from `--cwd` when provided, otherwise `process.cwd()`.
2. Walk upward (max 32 levels) for `atlas.config.json`.
3. For `init` only, fall back to structural detection (`package.json` + `apps/web` + `packages/ui`).
4. Stop at filesystem root; never search outside the resolved path chain.
5. Do not silently choose among unrelated contracts — the nearest ancestor wins.

Structural discovery only identifies candidate checkouts. `@atlas/project` validates both existing
and proposed contracts before `init` reports success or performs mutations.

---

## Version source

`atlas --version` reports the **installed `@atlas/cli` platform snapshot** SemVer from the CLI
package metadata. It works outside an Atlas project and does not depend on the current working
directory.

During `atlas init`, the CLI separately reports the **checkout/source snapshot** version from the
target repository root `package.json` (`@atlas/monorepo`). That value identifies the Atlas source
used to bootstrap the project and is independent of contract `schemaVersion`.

Machine-readable `--json` output may include:

```json
{
  "atlasVersion": "0.1.0",
  "contractSchemaVersion": 1,
  "cliPackage": "@atlas/cli"
}
```

---

## Current CLI commands

| Command            | Capability                                        | Status in v0.1 |
| ------------------ | ------------------------------------------------- | -------------- |
| `atlas generate …` | Feature + page shells                             | Implemented    |
| `atlas doctor`     | Diagnostics                                       | Implemented    |
| `atlas upgrade`    | Planning, dry-run, apply, JSON output             | Implemented    |
| Upgrade contract   | Baseline + rehearsal; see [upgrades](upgrades.md) | Implemented    |

The CLI exposes explicit command registration, shared context loading, exit codes, and output
conventions so additional commands can be added without redesigning the foundation.

---

## Related docs

- [Atlas project contract](atlas-contract.md)
- [Atlas Doctor](doctor.md)
- [Architecture ownership](architecture-ownership.md)
- [AGENTS.md](../../AGENTS.md)
