# @atlas/ui

Atlas UI foundation — a governed boundary around a reproducible stock shadcn Base UI preset. Atlas
ships architecture and behavioral helpers; shadcn owns the visual baseline.

## Locked shadcn preset

| Setting           | Value               |
| ----------------- | ------------------- |
| Primitive library | **Base UI**         |
| Style             | **Vega**            |
| Base color        | **Neutral**         |
| Theme             | **Blue**            |
| Chart color       | **Neutral**         |
| Heading           | **Inter**           |
| Font              | **Inter**           |
| Icons             | **Lucide**          |
| Radius            | **Default**         |
| Menu              | **Default / Solid** |
| Menu accent       | **Subtle**          |

**Preset code:** `bJzBPQGZc`

Verify:

```bash
pnpm dlx shadcn@latest preset decode bJzBPQGZc --json
pnpm dlx shadcn@latest preset resolve -c apps/web --json
```

Create URL: https://ui.shadcn.com/create?preset=bJzBPQGZc

## Architectural boundary

| Belongs in `@atlas/ui`                                                           | Belongs in `apps/web`      |
| -------------------------------------------------------------------------------- | -------------------------- |
| shadcn/Base UI primitives regenerated from the locked preset                     | Product layouts and shells |
| Behavioral helpers (`useZodForm`, server error mapping, theme preference)        | Domain-specific feature UI |
| Ergonomic compositions (`EmptyState`, `ErrorFallback`, `SkeletonList`, `Loader`) | Navigation wiring          |
| Theme preference + FOUC boot script                                              | Reference examples         |

Atlas differentiation lives in **architecture and conventions**, not in a competing design system.

## shadcn configuration

- App config: `apps/web/components.json` (`style: base-vega`, monorepo aliases → `packages/ui`)
- Package config: `packages/ui/components.json`
- Global CSS: `packages/ui/src/styles/globals.css` (generated preset tokens + monorepo `@source`
  directives)

Refresh upstream primitives:

```bash
pnpm dlx shadcn@latest apply bJzBPQGZc -c apps/web -y
pnpm dlx shadcn@latest add button -c packages/ui --overwrite -y
pnpm dlx shadcn@latest add dialog -c apps/web --diff
```

**Rule:** For upstream-derived primitives, shadcn-generated styling wins. Do not casually patch
padding, radii, colors, or focus rings in `packages/ui/src/components/ui/**`. Change the preset
deliberately, or compose in application code.

## Public API

```tsx
import { Button, EmptyState } from "@atlas/ui";
import "@atlas/ui/globals.css";
import { getThemeBootScriptContent } from "@atlas/ui/theme-boot";
```

Do not import from `packages/ui/src/**`.

## Atlas-owned behavior (non-visual contracts)

- `useTheme` / `ThemeProvider` / theme boot script — preference + `.dark` only
- `useZodForm`, `applyServerFieldErrors`, `getFormErrorMessage`
- `FormField` wrapper — accessibility wiring over `Field` primitives
- `EmptyState`, `ErrorFallback`, `Loader`/`PageLoader` — ergonomic compositions over canonical
  primitives

## Testing

```bash
pnpm --filter @atlas/ui test
pnpm --filter @atlas/ui build-storybook
```

Storybook uses the same Inter + Vega baseline as the app
(`packages/ui/.storybook/preview-head.html`).
