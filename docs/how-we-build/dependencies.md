# Dependency ownership

> **Direct imports require direct declarations. pnpm hoisting is never ownership.**

Atlas treats each workspace (`apps/*`, `packages/*`) as an independently installable unit. A
dependency must appear in the workspace manifest that directly imports it. Tests passing because
another workspace installed the same package is a defect.

For platform classification (starter vs reference vs packages), see
[architecture ownership](architecture-ownership.md).

---

## Core principles

| Principle                              | Meaning                                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Direct import → direct declaration** | If source, tests, Storybook, or build config imports a package, that workspace declares it          |
| **No hoisting reliance**               | Root `package.json` owns only tooling run from the repository root                                  |
| **Duplicates are allowed**             | Two workspaces may declare the same library when both import it directly                            |
| **Align when skew has no value**       | Match versions across workspaces for shared APIs (forms, Zod, MSW) unless divergence is intentional |
| **Peers for consumer singletons**      | React uses `peerDependencies` on UI packages; do not peer everything                                |
| **Implementation matches docs**        | Manifests, lockfile, tests, and docs describe the same supported majors                             |

---

## UI primitive ownership

```
third-party primitive (@base-ui/react, cmdk, sonner, …)
        ↓
     @atlas/ui          ← shadcn/Base UI components, cn, form helpers
        ↓
   application          ← product UI, layouts, feature views
```

- **Base UI** (`@base-ui/react`) is declared only in `@atlas/ui`, which imports primitives directly.
  Applications consume Base UI through `@atlas/ui` exports.
- **Radix** is not a direct Atlas dependency. Residual `@radix-ui/*` entries in the lockfile are
  transitive (for example from `cmdk`). Do not add Radix packages to app manifests.
- **shadcn** remains a runtime dependency of `@atlas/ui` because `globals.css` imports
  `shadcn/tailwind.css`. Regenerate components with `pnpm dlx shadcn@latest` per
  [packages/ui/README.md](../../packages/ui/README.md).
- Applications may import **sonner** and **lucide-react** directly for app-level notifications and
  icons; those are intentional app-owned declarations.

---

## Form ecosystem

| Package               | Owner                                                                      | Notes                                                       |
| --------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `react-hook-form`     | `@atlas/ui` (runtime); apps that import RHF types directly also declare it | Reference `UserForm` imports `Control`, `FieldValues`, etc. |
| `@hookform/resolvers` | `@atlas/ui` only                                                           | Used by `useZodForm`; apps use the hook, not the resolver   |
| `zod`                 | Every workspace that defines or validates schemas                          | Apps and `@atlas/project` both use Zod 3.24.1               |

`@hookform/resolvers` is aligned on **v4** in `@atlas/ui` (sole owner). v5 targets Zod 4
(`zod/v4/core`); Atlas standardizes on Zod **3.24.1** until a deliberate Zod major upgrade.

---

## Styling utilities

| Package                                              | Typical owner                                 |
| ---------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------- |
| `clsx`, `tailwind-merge`, `class-variance-authority` | `@atlas/ui`                                   | Apps use `cn`, `buttonVariants`, etc. from `@atlas/ui`        |
| `tw-animate-css`                                     | `@atlas/ui`                                   | Imported in `@atlas/ui` global CSS; not `tailwindcss-animate` |
| `@tailwindcss/postcss`, `tailwindcss`, `postcss`     | Workspace running the Next.js/Storybook build |

Applications import `@atlas/ui/globals.css` and re-export `@atlas/ui/postcss.config`; they do not
need duplicate styling utility packages unless they import those libraries directly.

---

## MSW (tests)

Atlas standardizes on **MSW v1** (`rest`, `setupServer` from `msw/node`) in application Jest tests.
Canonical examples live in `docs/how-we-build/testing.md` and `apps/*/src/test/setup/msw.ts`.

MSW v2 migration (`http`, `HttpResponse`) is tracked in
[follow-up backlog](../audit/follow-up-backlog.md)—do not document v2 APIs as current without
migrating handlers.

---

## Intentionally retained duplication (audit baseline)

| Dependency        | Workspaces                          | Why                                                                   |
| ----------------- | ----------------------------------- | --------------------------------------------------------------------- |
| `zod`             | apps, `@atlas/ui`, `@atlas/project` | Each defines or validates schemas locally                             |
| `lucide-react`    | apps, `@atlas/ui`                   | App shells and UI primitives both import icons                        |
| `sonner`          | apps, `@atlas/ui`                   | App `notify()` helpers and UI `Toaster` primitive                     |
| `react-hook-form` | `@atlas/ui`, `apps/reference`       | UI owns form primitives; reference imports RHF types in feature forms |
| Testing stack     | apps, `@atlas/ui`, `@atlas/consent` | Each workspace runs its own Jest suite                                |

---

## Audit procedure

1. List manifests: root, `apps/*/package.json`, `packages/*/package.json`.
2. For each external import in source/tests/config, confirm the owning workspace declares it.
3. Run `pnpm why <package>` and `pnpm --filter <workspace> why <package>` for suspected hoisting.
4. Run `pnpm dependencies:check` (see `scripts/validate-dependencies.mjs`).
5. After manifest edits: `pnpm install`, `pnpm install --frozen-lockfile`, then standard validation.

---

## Public release safety

Workspace references (`workspace:*`) are expected. The lockfile must not require private Git URLs,
`file:` paths, or authenticated registries for a public checkout. `dependencies:check` scans for
non-registry package sources.
