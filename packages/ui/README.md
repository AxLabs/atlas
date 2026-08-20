# @atlas/ui

Shared UI foundation for Atlas applications. Built with React, TypeScript, Tailwind CSS, and
Radix/shadcn-derived primitives.

## Architectural boundary

| Belongs in `@atlas/ui`                                         | Belongs in `apps/web`      |
| -------------------------------------------------------------- | -------------------------- |
| Generic visual primitives (Button, Card, Dialog)               | Product layouts and shells |
| Form helpers (`useZodForm`, server error mapping)              | Domain-specific feature UI |
| App-state components (EmptyState, ErrorFallback, SkeletonList) | Navigation wiring          |
| Theme provider and boot script                                 | Reference examples         |

Atlas differentiation lives in **architecture and conventions**, not in competing with shadcn as a
general-purpose component library. See
[architecture ownership](../../docs/how-we-build/architecture-ownership.md) and issue #42 for future
repositioning.

## Public API

Import from the package root or documented subpaths only:

```tsx
import { Button, EmptyState } from "@atlas/ui";
import "@atlas/ui/globals.css";
import { getThemeBootScriptContent } from "@atlas/ui/theme-boot";
```

Do not import from `packages/ui/src/**` — use `@atlas/ui` public exports.

## Components

- **Primitives** — Button, Card, Dialog, Form, Input, and other shadcn/Radix building blocks
- **App-state** — EmptyState, ErrorFallback, SkeletonList, Loader
- **Forms** — FormField wrapper, useZodForm, applyServerFieldErrors

## Styling

```tsx
import "@atlas/ui/globals.css";
```

Tailwind CSS v4 with design tokens and theme variables. No additional configuration needed.

## Testing

Components in this package require unit tests. Run:

```bash
pnpm --filter @atlas/ui test
```

Storybook stories document component usage.
