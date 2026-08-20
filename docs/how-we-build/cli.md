# Atlas CLI

> **Atlas-specific command-line workflows for project contract awareness and bootstrap.**

The Atlas CLI exists only for workflows where Atlas owns meaningful semantics. It does **not**
replace pnpm, Next.js, Turborepo, Git, Changesets, shadcn, ESLint, TypeScript, or Playwright.

See also: [Atlas project contract](atlas-contract.md),
[Releases and Governance](releases-and-governance.md).

---

## What the Atlas CLI owns

| Concern                 | Example                                                                |
| ----------------------- | ---------------------------------------------------------------------- |
| Atlas project contract  | Load `atlas.config.json` through `@atlas/project`                      |
| Platform version        | `atlas --version` reports the installed `@atlas/cli` platform snapshot |
| Project bootstrap       | `atlas init` initializes Atlas metadata in a compatible checkout       |
| Atlas generators        | `atlas generate feature …`, `atlas generate page …`                    |
| Future Doctor (#38)     | Report architecture conformance using resolved contract                |
| Future migrations (#43) | Upgrade contract schema versions                                       |

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

## Future public distribution (#24)

Issue #24 owns the public OSS cutover. When distribution is activated, `@atlas/cli` may become a
publishable artifact bundled with or alongside the public Atlas snapshot. Until then:

- Do not assume `npx atlas` against a public registry.
- Do not publish `@atlas/cli` merely to simplify local invocation.
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

There is **no** `create-atlas` command in v0.1 — new-project bootstrap from a public snapshot
remains coordinated with #24.

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

| File       | Purpose                                        |
| ---------- | ---------------------------------------------- |
| `index.ts` | Public feature boundary (module documentation) |

**Optional flags**

| Flag         | Adds                                                                  |
| ------------ | --------------------------------------------------------------------- |
| `--query`    | `keys.ts`, `queries.ts`, query hook scaffold with explicit TODO seams |
| `--mutation` | `mutations.ts`, mutation hook scaffold with explicit TODO seams       |
| `--form`     | `schema.ts`, `components/<Name>Form.tsx` using `@atlas/ui` forms      |
| `--tests`    | Feature tests (requires `--query`, `--mutation`, or `--form`)         |

When `capabilities.openApi` is `false`, query/mutation scaffolds use `@/lib/api` helpers instead of
typed OpenAPI imports. The generator never invents product endpoints or resource models.

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

| Input          | Rule                                                             |
| -------------- | ---------------------------------------------------------------- |
| Route          | Relative App Router fragment (`settings`, `settings/profile`)    |
| Dynamic routes | Simple segments such as `[id]` are supported                     |
| Existing route | May add `page.tsx` when sibling route files already exist        |
| Conflict       | Fails when the intended `page.tsx` already exists (no overwrite) |

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

---

## Exit codes

| Code | Meaning                                    |
| ---- | ------------------------------------------ |
| `0`  | Success                                    |
| `1`  | Unexpected internal error                  |
| `2`  | Invalid CLI usage                          |
| `3`  | Atlas project / contract not found         |
| `4`  | Invalid Atlas contract or project          |
| `5`  | Bootstrap conflict / incompatible checkout |
| `6`  | Missing prerequisite (Node, pnpm)          |
| `7`  | Generator conflict (destination exists)    |

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

## Deferred capabilities

| Issue | Capability         | Status in v0.1        |
| ----- | ------------------ | --------------------- |
| #37   | `atlas generate …` | Feature + page shells |
| #38   | `atlas doctor`     | Not implemented       |
| #43   | `atlas migrate`    | Not implemented       |

The CLI exposes explicit command registration, shared context loading, exit codes, and output
conventions so these commands can be added without redesigning the foundation.

---

## Related docs

- [Atlas project contract](atlas-contract.md)
- [Architecture ownership](architecture-ownership.md)
- [AGENTS.md](../../AGENTS.md)
